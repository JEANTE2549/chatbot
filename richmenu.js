require('dotenv').config();
const fs = require('fs');
const line = require('@line/bot-sdk');

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
});

const richMenus = {
  main: {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "Main Menu",
    chatBarText: "First",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 421 },
        action: { type: "postback", data: "action=consult_me" }
      },
      {
        bounds: { x: 1251, y: 0, width: 625 , height: 421 },
        action: { type: "postback", data: "action=rayong_area" }
      },
      {
        bounds: { x: 0, y: 422, width: 625, height: 421 },
        action: { type: "postback", data: "action=reservation_menu" }
      },
      {
        bounds: { x: 626, y: 422, width: 625, height: 421 },
        action: { type: "postback", data: "action=linktree_link" }
      },
      {
        bounds: { x: 1251, y: 422, width: 625, height: 421 },
        action: { type: "postback", data: "action=lampang_area" }
      },
      {
        bounds: { x: 1876, y: 0, width: 625, height: 759 },
        action: { type: "postback", data: "action=contact_detail" }
      },
      {
        bounds: { x: 1876, y: 760, width: 309, height: 84 },
        action: { type: "postback", data: "action=sw_page_3" }
      },
      {
        bounds: { x: 2185, y: 760, width: 309, height: 84 },
        action: { type: "postback", data: "action=sw_page_2" }
      },

    ]
  },
};

const uploadMenus = async () => {
  const results = {};
  for (const [key, menu] of Object.entries(richMenus)) {
    const richMenuId = await client.createRichMenu(menu);
    const imagePath = `RM image/${key}.png`; 
    const stream = fs.createReadStream(imagePath);
    await client.setRichMenuImage(richMenuId, stream, 'image/png');
    results[key] = richMenuId;
    console.log(`${key} menu created:`, richMenuId);
  }

  fs.writeFileSync('richmenu-ids.json', JSON.stringify(results, null, 2));
  
  await client.setDefaultRichMenu(results.main);
  console.log("Main menu set as default.");
};

uploadMenus().catch(console.error);