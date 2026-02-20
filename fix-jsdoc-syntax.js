const fs = require('fs');

function fixJSDoc(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\*\/\s*\/\*\*/g, '*/\n/**');
  fs.writeFileSync(file, content);
  console.log('Fixed syntax in', file);
}

fixJSDoc('src/handlers/chatHandlers.ts');
fixJSDoc('src/handlers/messageHandlers.ts');
fixJSDoc('src/handlers/conversationHandlers.ts');
