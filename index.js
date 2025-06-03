require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const webhookHandler = require('./webhook');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

app.post('/webhook', line.middleware(config), webhookHandler(config));

app.get('/', (req, res) => {
  res.send('get');
})

const richMenuIds = require('./richmenu-ids.json');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LINE bot is running on port ${port}`);
});
