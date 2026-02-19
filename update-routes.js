const fs = require('fs');

// 1. Update networksRoutes.ts
const nwFile = 'src/routes/networksRoutes.ts';
let nwText = fs.readFileSync(nwFile, 'utf8');
nwText = nwText.replace(
  '.use("/conversations", conversationRoutes)',
  '.use("/conversations", (req, res, next) => { req.query.platform = "networks"; next(); }, conversationRoutes)'
);
nwText = nwText.replace(
  '.use("/chat", chatRoutes)',
  '.use("/chat", (req, res, next) => { req.query.platform = "networks"; next(); }, chatRoutes)'
);
nwText = nwText.replace(
  '.use("/messages", messageRoutes)',
  '.use("/messages", (req, res, next) => { req.query.platform = "networks"; next(); }, messageRoutes)'
);
fs.writeFileSync(nwFile, nwText);

// 2. Update marketplaceRoutes.ts
const mpFile = 'src/routes/marketplaceRoutes.ts';
let mpText = fs.readFileSync(mpFile, 'utf8');
mpText = mpText.replace(
  '.use("/conversations", conversationRoutes)',
  '.use("/conversations", (req, res, next) => { req.query.platform = "marketplace"; next(); }, conversationRoutes)'
);
mpText = mpText.replace(
  '.use("/chat", chatRoutes)',
  '.use("/chat", (req, res, next) => { req.query.platform = "marketplace"; next(); }, chatRoutes)'
);
mpText = mpText.replace(
  '.use("/messages", messageRoutes)',
  '.use("/messages", (req, res, next) => { req.query.platform = "marketplace"; next(); }, messageRoutes)'
);
fs.writeFileSync(mpFile, mpText);

// 3. Update Swagger in chatRoutes, messageRoutes, conversationRoutes
function updateSwagger(filePath, oldPrefix, newPrefix) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(oldPrefix).join(newPrefix);

  // remove previous platform parameter in query
  content = content.replace(/ \*       - in: query\n \*         name: platform[\s\S]*?default: marketplace\n/g, '');

  const paramBlock = ` *     parameters:\n *       - in: path\n *         name: platform\n *         required: true\n *         schema:\n *           type: string\n *           enum: [marketplace, networks]`;

  const lines = content.split('\n');
  const outLines = [];
  for (let i = 0; i < lines.length; i++) {
    outLines.push(lines[i]);
    if (lines[i].includes(' *     tags: [')) {
      if (!lines[i + 1]?.includes('parameters:')) {
        outLines.push(paramBlock);
      }
    }
  }
  fs.writeFileSync(filePath, outLines.join('\n'));
}

updateSwagger('src/routes/chatRoutes.ts', ' * /api/v1/chat/', ' * /api/v1/{platform}/chat/');
updateSwagger('src/routes/messageRoutes.ts', ' * /api/v1/messages/', ' * /api/v1/{platform}/messages/');
updateSwagger('src/routes/conversationRoutes.ts', ' * /api/v1/conversations', ' * /api/v1/{platform}/conversations');

console.log('Update finished');
