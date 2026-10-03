const { Rcon } = require('rcon-client');

// ADD ALL THE MINECRAFT USERNAMES YOU WANT TO BAN HERE
const studentsToBan = [
  "Fr0zennz",
  "Luvonoqs",
  "jarredpogi",
  "Ryuichiio"
  // Add more names here, one per line, in quotes
];

async function run() {
  console.log("🔌 Connecting to Minecraft server...");
  
  try {
    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: parseInt(process.env.RCON_PORT, 10),
      password: process.env.RCON_PASSWORD
    });
    
    console.log("✅ Connected successfully!");

    for (const student of studentsToBan) {
      try {
        // This sends the ban command to your server console
        const reason = "Homeroom tasks not completed. Request access via the website!";
        await rcon.send(`ban ${student} ${reason}`);
        console.log(`🔨 Banned: ${student}`);
      } catch (e) {
        console.log(`⚠️ Could not ban ${student} (they might already be banned)`);
      }
    }
    
    await rcon.end();
    console.log("🎉 Done! All students have been banned.");
    
  } catch (err) {
    console.error("❌ RCON Connection Failed. Is Localtonet running and is the server on?");
    console.error(err);
  }
}

run();
