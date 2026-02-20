const fs = require('fs');

function fixDuplicateParameters(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // We inserted exactly this block:
  //  *     parameters:
  //  *       - in: path
  //  *         name: platform
  //  *         required: true
  //  *         schema:
  //  *           type: string
  //  *           enum: [marketplace, networks]
  
  // To fix this gracefully without relying on complex string manipulation,
  // we will replace instances where our inserted block exists, and there is another `parameters:` later in the same swagger block.
  // Actually, the easiest way is:
  // 1. Remove our inserted string completely.
  
  const rogueBlock = ` *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]\n`;
 
  content = content.replace(new RegExp(rogueBlock.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&'), 'g'), '');
  
  const rogueBlock2 = ` *     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]`;
         
   content = content.replace(new RegExp(rogueBlock2.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&'), 'g'), '');

  // 2. Re-insert the platform parameter correctly.
  // We need to look at each `@swagger` block.
  const blocks = content.split(' * @swagger');
  
  for (let i = 1; i < blocks.length; i++) {
    let block = blocks[i];
    
    // Check if it already has parameters:
    if (block.includes('*     parameters:')) {
      // Append our parameter to the existing parameters list
      block = block.replace('*     parameters:', `*     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]`);
    } else {
      // No parameters exist, we can safely just append it after tags: or security:
      // Let's insert it before the responses: block, since responses is always required
      if (block.includes('*     responses:')) {
         block = block.replace('*     responses:', `*     parameters:
 *       - in: path
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marketplace, networks]
 *     responses:`);
      }
    }
    
    blocks[i] = block;
  }
  
  fs.writeFileSync(file, blocks.join(' * @swagger'));
  console.log('Fixed', file);
}

fixDuplicateParameters('src/handlers/chatHandlers.ts');
fixDuplicateParameters('src/handlers/messageHandlers.ts');
fixDuplicateParameters('src/handlers/conversationHandlers.ts');
