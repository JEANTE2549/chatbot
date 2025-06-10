const fs = require('fs');
const path = require('path');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

const richMenuIds = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'richmenu-ids.json'))
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = (config) => {
  const client = new line.Client(config);

  async function getPropertiesFromSupabase(area, type) {
  const { data, error } = await supabase
    .from('house_projects')
    .select('name, price, image_url, status, property_type, district, id')
    .eq('status', true)
    .eq('property_type', type)
    .ilike('district', `%${area.trim()}%`)
    .limit(10); 
  if (error) {
    console.error('Supabase error:', error);
    return [];
  }

  return data.map(p => ({
    name: p.name,
    price: `฿${Number(p.price).toLocaleString()}`,
    image: p.image_url ,
    id: p.id
  }));
}

  async function getAdminFromSupabase() {
  const { data, error } = await supabase
    .from('admin')
    .select('name, tel, img_admin')
    .limit(10); 
  if (error) {
    console.error('Supabase error:', error);
    return [];
  }

  return data.map(a => ({
    name: a.name,
    tel: a.tel,
    img: a.img_admin,
  }));
  }

    return async (req, res) => {
      try {
        await Promise.all(req.body.events.map(async (event) => {
          const userId = event.source.userId;
          const userName = event.source.userName || 'ผู้ใช้';

          if (event.type === 'postback') {
            const data = new URLSearchParams(event.postback.data);
            const action = data.get('action');

            if (action === 'switch_tab') {
              const menu = data.get('menu');
              const newMenuId = richMenuIds[menu];
              if (newMenuId) {
                return client.linkRichMenuToUser(userId, newMenuId);
              }
            }

            if (action === 'rayong_area') {
              return client.replyMessage(event.replyToken, RayongFlexMessage);
            }
            if (action === 'lampang_area') {
              return client.replyMessage(event.replyToken, LampangFlexMessage);
            }
            if (action === 'linktree_link') {
              return client.replyMessage(event.replyToken, LinktreeFlexMessage);
            }
            if (action === 'consult_me') {
              return client.replyMessage(event.replyToken, ConsultMeFlexMessage);
            }

            if (action === 'reservation_menu') {
              const { data: user, error: userError } = await supabase
                .from('users')
                .select('interest')
                .eq('line_user_id', userId)
                .maybeSingle();

              if (userError || !user?.interest) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'กรุณาเลือกบ้านที่คุณสนใจก่อนนะคะ 🏡\nสามารถเลือกได้จาก Rich Menu ค่ะ 😊',
                });
              }
              const rawInterest = user.interest;
              const interestList = rawInterest.split(',').map(name => name.trim());

              if (interestList.length === 0) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'คุณยังไม่ได้เลือกบ้านที่สนใจเลยค่ะ 😅\nกรุณาเลือกจาก Rich Menu ก่อนนะคะ',
                });
              }
              const { data: houses, error: houseError } = await supabase
                .from('house_projects')
                .select('name, price, image_url')
                .in('name', interestList);
              if (houseError || !houses || houses.length === 0) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'ไม่พบข้อมูลบ้านที่คุณสนใจในระบบค่ะ 🧐',
                });
              }
              const carousel = {
                type: 'template',
                altText: 'เลือกบ้านที่คุณต้องการนัดดู',
                template: {
                  type: 'carousel',
                  columns: houses.slice(0, 10).map(house => ({
                    thumbnailImageUrl: house.image_url ,
                    title: house.name.slice(0, 40),
                    text: `฿${Number(house.price).toLocaleString()}`,
                    actions: [
                      {
                        type: 'message',
                        label: '📅 นัดดูอสังหาริมทรัพย์',
                        text: `🛖 นัดดู: ${house.name}`
                      }
                    ]
                  }))
                }
              };
              return client.replyMessage(event.replyToken, carousel);
            }

            if (action === 'consult') {
              const role = data.get('role');
              
              if (role === 'buyer') {
                const { data, error : RoleStuck } = await supabase
                .from('users')
                .upsert({ line_user_id: userId, role: role }, { onConflict: ['line_user_id'] });
                if (RoleStuck) {
                  console.error('Supabase error:', RoleStuck);
                  return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลค่ะ 😢 \nโปรดรอadmin มาตอบค่ะ'
                  });
                }
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'ยินดีค่ะ! แอดมินจะติดต่อกลับเพื่อปรึกษาเรื่องการหาบ้านให้คุณค่ะ 😊\nระหว่างรอสามารถลองเล่นเมนูด้านล่างก่อนได้เลยนะคะ'
                });
              }
              if (role === 'investor') {
                const { data, error : RoleStuck } = await supabase
                .from('users')
                .upsert({ line_user_id: userId, role: role }, { onConflict: ['line_user_id'] });
                if (RoleStuck) {
                  console.error('Supabase error:', RoleStuck);
                  return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลค่ะ 😢 \nโปรดรอadmin มาตอบค่ะ'
                  });
                }
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'ขอบคุณที่สนใจค่ะ! แอดมินจะติดต่อกลับเพื่อปรึกษาเรื่องการลงทุนอสังหาริมทรัพย์ให้คุณค่ะ 😊\nระหว่างรอสามารถลองเล่นเมนูด้านล่างก่อนได้เลยนะคะ'
                });
              }
              if (role === 'expat_buyer') {
                const { data, error : RoleStuck } = await supabase
                .from('users')
                .upsert({ line_user_id: userId, role: role }, { onConflict: ['line_user_id'] });
                if (RoleStuck) {
                  console.error('Supabase error:', RoleStuck);
                  return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลค่ะ 😢 \nโปรดรอadmin มาตอบค่ะ'
                  });
                }
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'Welcome! Our admin will contact you soon to assist with your property search in Thailand. 😊\nIn the meantime, feel free to explore the menu below.'
                });
              }
            }
            
            if (action === 'contact_detail') {
              const admin = await getAdminFromSupabase();
              return client.replyMessage(event.replyToken,{
                type: 'template',
                altText: 'ข้อมูล Adminผู้ดูแล',
                template: {
                  type: 'carousel',
                  columns: admin.map(a => ({
                    thumbnailImageUrl: a.img,
                    title: a.name.slice(0, 40),
                    text: 'tel: ' + a.tel,
                    actions: [
                    { type: 'uri', label: 'โทรปรึกษา', uri: `tel:${a.tel}` }
                  ]
                  }))
                }               
              });
            }

            if (action === 'show_property') {
              const area = data.get('area');
              const{data: area_data , error} = await supabase
              .from('users')
              .update({ area_interest: area })
              .eq('line_user_id', userId);
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `คุณสนใจทรัพย์ประเภทไหนใน "${area}" คะ?`,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'บ้านเดี่ยว',
                        data: 'action=property_type&type=บ้านเดี่ยว'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'ทาว์นโฮม',
                        data: 'action=property_type&type=ทาว์นโฮม'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'บ้านแฝด',
                        data: 'action=property_type&type=บ้านแฝด'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'คอนโด',
                        data: 'action=property_type&type=คอนโด'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'อพาร์ทเม้นท์',
                        data: 'action=property_type&type=อพาร์ทเม้นท์'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'ที่ดิน',
                        data: 'action=property_type&type=ที่ดิน'
                      }
                    },
                  ]
                }
              });
            }

            if (action === 'property_type') {
              const type = data.get('type');
              const { data: user } = await supabase
                .from('users')
                .select('area_interest')
                .eq('line_user_id', userId)
                .single();
              const area = user?.area_interest;
              const{error} = await supabase
                .from('users')
                .update({ property_type_interest: type })
                .eq('line_user_id', userId);
              if (!area) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'ขออภัย ไม่พบข้อมูลพื้นที่ กรุณาเริ่มใหม่โดยเลือกทำเลก่อนค่ะ 🗺️'
                });
              }
              const properties = await getPropertiesFromSupabase(area, type);
              if (!properties || properties.length === 0) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: `ไม่พบทรัพย์ประเภท "${type}" ในพื้นที่ "${area}" ค่ะ 😔`
                });
              }
            const carouselColumns = properties.map(p => ({
              thumbnailImageUrl: p.image,
              title: p.name.slice(0, 40),
              text: p.price,
              actions: [
                { type: 'message', label: 'สนใจ', text: `สนใจ ${p.name}` },
                { type: 'postback', label: 'ดูรายละเอียด', data: `action=more_detail&name=${p.name}`},
                { type: 'message', label: 'แชร์ทรัพย์', text: "แชร์ทรัพย์: " + p.name },
              ]
            }));

            return client.replyMessage(event.replyToken, {
              type: 'template',
              altText: 'รายการทรัพย์',
              template: {
                type: 'carousel',
                columns: carouselColumns
              }
            });
            }

          if (action === 'more_detail') {
            const data = new URLSearchParams(event.postback?.data || '');
            const name = data.get('name');
            const { data: property, error } = await supabase
              .from('house_projects')
              .select('*')
              .eq('name', name)
              .single();

            if (error || !property) {
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'ขออภัย ไม่พบข้อมูลทรัพย์นี้ค่ะ'
              });
            }
            const flexMsg = {
              type: 'flex',
              altText: `รายละเอียดทรัพย์: ${property.name}`,
              contents: {
                type: 'bubble',
                hero: {
                  type: 'image',
                  url: property.image_url,
                  size: 'full',
                  aspectRatio: '20:13',
                  aspectMode: 'cover'
                },
                body: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: property.name,
                      weight: 'bold',
                      size: 'lg',
                      wrap: true
                    },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: `฿${Number(property.price).toLocaleString()}`,
                          weight: 'bold',
                          color: '#27ACB2',
                          size: 'md'
                        },
                        {
                          type: 'text',
                          text: property.property_type || '-',
                          weight: 'bold',
                          align: 'end',
                          size: 'sm'
                        }
                      ]
                    },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      spacing: 'sm',
                      margin: 'md',
                      contents: [
                        {
                          type: 'text',
                          text: `พท.${property.area_sqm || '-'} ตร.ม.`,
                          size: 'sm'
                        },
                        {
                          type: 'text',
                          text: `🛏 ${property.Bedroom || '-'} ห้องนอน`,
                          size: 'sm',
                        },
                        {
                          type: 'text',
                          text: `🛁 ${property.Bathroom || '-'} ห้องน้ำ`,
                          size: 'sm',
                          align: 'end',
                        }
                      ]
                    },
                    { type: 'separator' },
                    { type: 'text', text: 'ที่ตั้งโครงการ', weight: 'bold', size: 'sm' },
                    { type: 'text', text: property.location || '-', size: 'sm', wrap: true },
                    { type: 'text', text: `ใกล้: ${(property.nearby_area || []).join(', ')}`, size: 'xs', wrap: true },
                    { type: 'text', text: property.map_link|| '-', size: 'xs', color: '#1E90FF', wrap: true },
                    { type: 'separator' },
                    { type: 'text', text: 'รายละเอียดเพิ่มเติม:', weight: 'bold', size: 'sm' },
                    { type: 'text', text: `${(property.extra_detail || ['-']).join('\n')}`, size: 'xs', wrap: true },
                    { type: 'text', text: `สิ่งอำนวยความสะดวก: ${(Array.isArray(property.facilities) ? property.facilities : []).join(', ')}`, size: 'xs', wrap: true },
                    { type: 'separator' },
                    { type: 'text', text: 'รายการของแถมและโปรโมชั่น:', weight: 'bold', size: 'sm' },
                    { type: 'text', text: `โปรโมชั่นของเดือนนี้: ${property.promotion || '-'}`, size: 'sm', wrap: true },
                    { type: 'text', text: `ของแถม: \n${(property.free_gift || []).join('\n')}`, size: 'xs', wrap: true }
                  ]
                }
              }
            };
            return client.replyMessage(event.replyToken, flexMsg);
          }
          }
          
          if (event.type === 'follow') {
            const profile = await client.getProfile(userId);
            const userName = profile.displayName || 'ผู้ใช้';
            const replyMessage = [welcomeFlexMessage,ConsignmentFlexMessage];
            await client.replyMessage(event.replyToken, replyMessage);
            const { data, error } = await supabase
              .from('users')
              .upsert(
                { line_user_id: userId, line_user_name: userName },
                { onConflict: ['line_user_id'] }
              );
          }

          if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text;
            const userId = event.source.userId;
            const textLower = text.toLowerCase();

            if (text.startsWith('แชร์ทรัพย์: ')) {
              const propertyId = text.replace('แชร์ทรัพย์: ', '').trim();
              const LIFFlink = `https://liff.line.me/2007520214-YpaPvNR1/?propertyId=${encodeURIComponent(propertyId)}`
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: `แชร์อสังหาแห่งนี้ที่คุณสนใจให้คนที่คุณรักใน line ผ่านปุ่มด้านล่างนี้ค่ะ👇`,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'uri',
                        label: 'แชร์หาเพื่อน',
                        uri: `https://line.me/R/msg/text/?${encodeURIComponent('บ้านนี้น่าสนใจ! 🏠 ลองดูสิ: ' + LIFFlink)}`
                      },
                    },
                  ],
                },
              });
            }

            if (text.startsWith('สนใจ ')) {
              const interest = text.replace(/สนใจ/gi, '').trim();

              const { data: found } = await supabase
                .from('house_projects')
                .select('name')
                .ilike('name', `%${interest}%`)
                .maybeSingle();

              if (!found) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: `ไม่พบโครงการ "${interest}" ค่ะ กรุณาตรวจสอบอีกครั้ง`
                });
              }

              const { data: user, error: userError } = await supabase
                .from('users') 
                .select('name, phone, interest')
                .eq('line_user_id', userId)
                .maybeSingle();

              if (userError) {
                console.error('Supabase error:', userError);
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผู้ใช้ค่ะ 😢'
                });
              }

              let interests = user?.interest ? user.interest.split(',').map(i => i.trim()) : [];
              if (!interests.includes(found.name)) {
                interests.push(found.name);
              }
              const updatedInterest = interests.join(', ');
              const { error: updateError } = await supabase
                .from('users')
                .upsert({ line_user_id: userId, interest: updatedInterest }, { onConflict: ['line_user_id'] });

              if (updateError) {
                console.error('Supabase error:', updateError);
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'เกิดข้อผิดพลาดในการบันทึกความสนใจค่ะ 😢'
                });
              }

              if (user?.name && user?.phone) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: `เยี่ยมเลยค่ะ โครงการ "${found.name}" ก็น่าสนใจมาก\nหากท่านเลือกอสังหาที่ท่านชื่นชอบเสร็จแล้วสามารถนัดเวลาดูอสังหาที่ท่านเลือกได้ที่เมนูด้านล่างได้เลยค่ะ 😊`
                },
              );
              }
  
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `คุณสนใจโครงการ "${found.name}"\n\nกรุณาพิมพ์ชื่อและเบอร์โทรเพื่อติดต่อกลับค่ะ 📞\nตัวอย่าง: สมชาย ใจดี 088999777`
              });
            }
            const phoneRegex = /(\d{9,11}|\d{2,4}-\d{3}-\d{3,4}|\d{2,4} \d{6,8}|\d{3} \d{3} \d{4})/;
            const phoneMatch = text.match(phoneRegex);
            if (phoneMatch) {
              let rawPhone = phoneMatch[1];
              const phone = rawPhone.replace(/-/g, '').replace(/ /g, '');
              let name = text
                .replace(/ชื่อ/gi, '')     
                .replace(/เบอร์/gi, '')  
                .replace(/ชื่อ:/gi, '')
                .replace(/เบอร์:/gi, '')
                .replace(/:/gi, '')
                .replace(rawPhone, '') 
                .trim();

              const { data, error } = await supabase
              .from('users')
              .upsert({ line_user_id: userId, name, phone }, { onConflict: ['line_user_id'] });
                if (error) {
                  console.error('Supabase error:', error);
                  return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล 😢 \nโปรดรอadmin มาตอบค่ะ'
                  });
                }
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: `📌 ขอบคุณค่ะ คุณ ${name} เบอร์ ${phone} ทางเราจะติดต่อกลับเร็วๆ นี้ค่ะ!`
                });
              }

            if (text.startsWith('🛖 นัดดู:')) {
              const propertyName = text.split(':')[1].trim();
              await supabase
                .from('users')
                .update({ reservation_property: propertyName })
                .eq('line_user_id', userId);
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `กรุณาเลือกวันและเวลาสำหรับ "${propertyName}" ผ่านปุ่มด้านล่างนี้ค่ะ👇`,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'uri',
                        label: '📅 เลือกวันเวลา',
                        uri: `https://liff.line.me/2007520214-3V1lDOWV?house=${encodeURIComponent(propertyName)}`, 
                      },
                    },
                  ],
                },
              });
            }

            if (text.startsWith('🗓 ขอจองนัดดูอสังหาริมทรัพย์')) {
              const dateMatch = text.match(/วันที่:\s*(\d{4}-\d{2}-\d{2})/);
              const timeMatch = text.match(/เวลา:\s*(\d{2}:\d{2})/);

              if (!dateMatch || !timeMatch) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'เกิดข้อผิดพลาดในการอ่านวันที่หรือเวลาจากข้อความ กรุณาลองใหม่ค่ะ',
                });
              }

              const date = dateMatch[1];
              const time = timeMatch[1];
              const reservationTimestampz = (`${date} ${time}:00`);

              const { data, error } = await supabase
                .from('users')
                .upsert(
                  { line_user_id: userId, reservation: reservationTimestampz },
                  { onConflict: ['line_user_id'] }
                );

              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'คุณต้องการยืนยันการจองนี้หรือไม่?',
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '✅ ยืนยัน',
                        text: 'ยืนยันจองดูอสังหา',
                      },
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '❌ ยกเลิก',
                        text: 'ยกเลิกการจอง',
                      },
                    },
                  ],
                },
              });
            }

            if (event.message.text === 'ยืนยันจองดูอสังหา') {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'ขอบคุณค่ะ! แอดมินจะติดต่อกลับเพื่อยืนยันการนัดดูอสังหาที่ท่านสนใจค่ะ 😊',
                });
              }
            if (event.message.text === 'ยกเลิกการจอง') {
              const { error } = await supabase
              .from('users')
              .update({ reservation: null })
              .eq('line_user_id', userId);
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'การจองของคุณถูกยกเลิกแล้วค่ะ หากต้องการนัดใหม่ กรรุณากดที่เมนู "นัดดูอสังหาริมทรัพย์" ใหม่อีกรอบค่ะ 😊',
                });
              }

            if (text.startsWith('📋 สรุปแบบฟอร์ม')) {
              const parseFormMessage = (text) => {
                const result = {};
                const phoneRegex = /(\d{9,11}|\d{2,4}-\d{3}-\d{3,4}|\d{2,4} \d{6,8}|\d{3} \d{3} \d{4})/;
                const lines = text.trim().split('\n');
                for (const line of lines) {
                  if (!line.includes(':')) continue;
                  const [rawKey, ...valueParts] = line.split(':');
                  const key = rawKey.trim().replace('📋 สรุปแบบฟอร์ม', '');
                  const value = valueParts.join(':').trim();
                  if (key && value) result[key] = value;
                }
                const phoneMatch = text.match(phoneRegex);
                if (phoneMatch) {
                  const rawPhone = phoneMatch[1];
                  result['เบอร์โทร'] = rawPhone.replace(/[-\s]/g, '');
                }
                return result;
              };
              const parsed = parseFormMessage(text);
              const intentValue = parsed['ซื้อหรือเช่า']?.includes('ซื้อ') ? true : false;
              const payload = {
                line_user_id: userId,
                role: parsed['role'] || null,
                name: [parsed['ชื่อ'], parsed['นามสกุล']].filter(Boolean).join(' ').trim() || null,
                phone: parsed['เบอร์โทร'] || null,
                intent: intentValue,
                area_interest: [parsed['จังหวัด'], parsed['อำเภอ']].filter(Boolean).join(' ').trim() || null
              };
              const { data, error } = await supabase
                .from('users')
                .upsert(payload, { onConflict: ['line_user_id'] });

              if (error) {
                console.error('Supabase error:', error);
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล 😢 \nโปรดรอ admin มาตอบค่ะ'
                });
              }
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `✅ ระบบได้รับข้อมูลแล้วค่ะ\nคุณ ${payload.name}\nเราจะติดต่อกลับทางเบอร์ ${payload.phone}`
              });
            }

          }
        }));
        res.status(200).end();
      } catch (err) {
        console.error(err);
        res.status(500).end();
      }
    };
};

const welcomeFlexMessage = {
  type: 'flex',
  altText: 'ยินดีต้อนรับสู่ LINE Bot ของเรา!',
  contents: {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: 'https://res.cloudinary.com/dxbzwwab6/image/upload/v1748876397/uploads/image.jpg',
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'ยินดีต้อนรับค่ะ 🎉',
          weight: 'bold',
          size: 'xl'
        },
        {
          type: 'text',
          text: 'เราช่วยคุณหาบ้านง่าย ๆ ด้วยเมนูด้านล่าง ⬇️\n\n🏠 ดูบ้านตามพื้นที่\n💬 ปรึกษาฟรี\n📄 ดูเงื่อนไขและโปรโมชั่น',
          size: 'sm',
          wrap: true,
          color: '#666666'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#00B900',
          action: {
            type: 'postback',
            label: 'เลือกทำเล',
            data: 'action=rayong_area'
          }
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'ดูวิธีใช้เมนู',
            uri: 'https://liff.line.me/2007520214-Q2NWqw94'
          }
        }
      ]
    }
  }
};

const RayongFlexMessage = {
  type: 'flex',
  altText: 'เลือกทำเลที่สนใจ',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'คุณสนใจทำเลไหน?',
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'ปลวกแดง',
                data: 'action=show_property&area=ปลวกแดง'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'อำเภอเมือง',
                data: 'action=show_property&area=อำเภอเมืองระยอง'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'บ้านค่าย',
                data: 'action=show_property&area=บ้านค่าย'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'นิคมพัฒนา',
                data: 'action=show_property&area=นิคมพัฒนา'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'บ้านฉาง',
                data: 'action=show_property&area=บ้านฉาง'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'มาบตาพุด',
                data: 'action=show_property&area=มาบตาพุด'
              },
              style: 'primary',
              color: '#36B37E'
            }
          ]
        }
      ]
    }
  }
};

const LampangFlexMessage = {
    type: 'flex',
  altText: 'เลือกทำเลที่สนใจ',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'คุณสนใจทำเลไหน?',
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'อำเภอเมือง',
                data: 'action=show_property&area=อำเภอเมืองลำปาง'
              },
              style: 'primary',
              color: '#36B37E'
            },
          ]
        }
      ]
    }
  }
};

const ConsultMeFlexMessage = {
  type: 'flex',
  altText: 'ปรึกษาฟรี',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'คุณคือใคร?',
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'คนหาบ้านเพื่ออยู่อาศัย',
                data: 'action=consult&role=buyer'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'นักลงทุนอสังหา',
                data: 'action=consult&role=investor'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'Foreign Buyer',
                data: 'action=consult&role=expat_buyer'
              },
              style: 'primary',
              color: '#36B37E'
            },
          ]
        }
      ]
    }
  }
};

const ConsignmentFlexMessage = {
  type: 'flex',
  altText: 'ลงประกาศขายบ้าน',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'คุณคือใคร?',
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'เจ้าของทรัพย์',
                data: 'action=consignmente&role=owner'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'นายหน้าอสังหา',
                data: 'action=consignmente&role=agent'
              },
              style: 'primary',
              color: '#36B37E'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label:'Foreign Seller',
                data: 'action=consignmente&role=foreign_seller'
              },
              style: 'primary',
              color: '#36B37E'
            },
          ]
        }
      ]
    }
  }
};

const LinktreeFlexMessage = {
  type: 'flex',
  altText: 'ช่องทางการติมตามเพิ่มเติม',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'ช่องทางการติมตามเพิ่มเติม',
          weight: 'bold',
          size: 'xl',
          wrap: true
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: 'linktree',
                uri: 'https://linktr.ee/lumehome.th'
              },
              style: 'primary',
              color: '#36B37E'
            },
          ]
        }
      ]
    }
  }
};