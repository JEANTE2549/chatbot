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

  async function getPropertiesFromSupabase(area) {
  const { data, error } = await supabase
    .from('house_projects')
    .select('name, price, image_url')
    .eq('status', true)
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
            
            if (action === 'contract_detail') {
              const admin = await getAdminFromSupabase();
              return client.replyMessage(event.replyToken,{
                type: 'template',
                altText: 'Admin information',
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
              const properties = await getPropertiesFromSupabase(area);
              if (properties.length === 0) {
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: `ขออภัย ไม่พบทรัพย์ในพื้นที่ "${area}" ค่ะ 🏡`
                });
              }
              return client.replyMessage(event.replyToken, {
                type: 'template',
                altText: 'รายการทรัพย์สิน',
                template: {
                  type: 'carousel',
                  columns: properties.map(p => ({
                    thumbnailImageUrl: p.image,
                    title: p.name.slice(0, 40),
                    text: p.price,
                    actions: [
                      { type: 'message', label: 'สนใจ', text: `สนใจ ${p.name}` }
                    ]
                  }))
                }
              });
            }
          }
          
          if (event.type === 'follow') {
            await client.replyMessage(event.replyToken, welcomeFlexMessage);
          }

          if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text;
            const userId = event.source.userId;
            const textLower = text.toLowerCase();

            if (textLower.includes('สวัสดี') || text.includes('hello')) {
              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'สวัสดีค่ะ! ยินดีต้อนรับสู่ LINE Bot ของเรา! 🎉'
              });
            }

          if (textLower.startsWith('สนใจ ')) {
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
                text: `เยี่ยมเลยค่ะ โครงการ "${found.name}" ก็น่าสนใจมาก\nโปรดรอแอดมินติดต่อกลับนะคะ 😊`
              });
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
            uri: 'https://res.cloudinary.com/dxbzwwab6/raw/upload/v1748877284/uploads/file'
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