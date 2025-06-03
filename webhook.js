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
    .select('name, price, image_url, detail')
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
    url: p.detail
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
              return client.replyMessage(event.replyToken, {
                type: 'template',
                altText: 'เลือกทำเลที่สนใจ',
                template: { 
                  type: 'buttons',
                  text: 'คุณสนใจทำเลไหน?',
                  actions: [
                    { type: 'postback', label: 'ปลวกแดง', data: 'action=show_property&area=ปลวกแดง' },
                    { type: 'postback', label: 'เมือง', data: 'action=show_property&area=เมือง' }
                  ]
                }
              });
            }

            if (action === 'show_property') {
              const area = data.get('area');
              console.log('User selected area:', area);
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
            if (textLower.includes('สนใจ')) {
              return client.replyMessage(event.replyToken,InterestFlexMessage);
            }
                        const match = text.match(/ชื่อ\s*(\S+)\s*เบอร์\s*(\d{9,10})/);
            if (match) {
              const name = match[1];
              const phone = match[2];

              const { data, error } = await supabase
                .from('users')
                .upsert({ line_user_id: userId, name, phone }, { onConflict: ['line_user_id'] });

              if (error) {
                console.error('Supabase error:', error);
                return client.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล 😢'
                });
              }

              return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `ขอบคุณครับ คุณ ${name} 📲 เบอร์ ${phone} เราบันทึกข้อมูลเรียบร้อยแล้วครับ`
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

const InterestFlexMessage ={
  "type": "flex",
  "altText": "กรุณากรอกชื่อและเบอร์โทร",
  "contents": {
    "type": "bubble",
    "hero": {
      "type": "image",
      "url": "https://cdn-icons-png.flaticon.com/512/747/747376.png",
      "size": "full",
      "aspectRatio": "1.51:1",
      "aspectMode": "cover"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "text",
          "text": "ยินดีต้อนรับค่ะ 👋",
          "weight": "bold",
          "size": "xl"
        },
        {
          "type": "text",
          "text": "กรุณาพิมพ์ข้อความตามนี้เพื่อให้เราติดต่อกลับ:",
          "wrap": true,
          "size": "sm",
          "color": "#666666"
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#f3f4f6",
          "cornerRadius": "md",
          "paddingAll": "12px",
          "contents": [
            {
              "type": "text",
              "text": "ชื่อบาส เบอร์ 0891234567",
              "wrap": true,
              "color": "#111111",
              "size": "md"
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "style": "primary",
          "color": "#1DB446",
          "action": {
            "type": "message",
            "label": "กรอกข้อมูลเลย",
            "text": "ชื่อบาส เบอร์ 0891234567"
          }
        }
      ]
    }
  }
}

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