const { Rcon } = require('rcon-client');

// ⚠️ CHANGE THIS TO YOUR EXACT MINECRAFT USERNAME SO YOU DON'T BAN YOURSELF!
const ADMIN_NAME = "Kurayamisuna"; 

async function run() {
  console.log("🔌 Connecting to Minecraft server...");
  
  try {
    const rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: parseInt(process.env.RCON_PORT, 10),
      password: process.env.RCON_PASSWORD
    });
    
    console.log("✅ Connected successfully!");

    // 1. Get the list of online players
    const listResponse = await rcon.send("list");
    console.log("Server response:", listResponse);

    // 2. Extract player names from the output (e.g., "There are 3 players online: Fr0zennz, Luvonoqs, Ryuichiio")
    const match = listResponse.match(/:\s*(.+)/);
    
    if (match && match[1]) {
      // Split the names by comma and clean up spaces
      const players = match[1].split(',').map(p => p.trim());
      
      console.log(`Found ${players.length} players online.`);

      for (const player of players) {
        // Skip the admin so you don't lock yourself out!
        if (player.toLowerCase() === ADMIN_NAME.toLowerCase()) {
          console.log(`🛡️ Skipping admin: ${player}`);
          continue;
        }
        
        try {
          const reason = "Homeroom tasks not completed. Request access via the website!";
          await rcon.send(`ban ${player} ${reason}`);
          console.log(`🔨 Banned: ${player}`);
        } catch (e) {
          console.log(`⚠️ Could not ban ${player} (might already be banned)`);
        }
      }
    } else {
      console.log("✅ No players found online to ban.");
    }
    
    await rcon.end();
    console.log("🎉 Done! All online players (except admin) have been banned.");
    
  } catch (err) {
    console.error("❌ RCON Connection Failed. Is Localtonet running and is the server on?");
    console.error(err);
  }
}

run();
