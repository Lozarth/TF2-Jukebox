# TF2-Jukebox

## HOW TO SETUP
1. INSTALL [VB-AUDIO VIRTUAL CABLE](https://vb-audio.com/Cable/)
2. CHANGE YOUR TF2 STEAM LAUNCH ARGUMENTS TO THE FOLLOWING:  
   `-usercon +ip 0.0.0.0 +alias ip +sv_rcon_whitelist_address 127.0.0.1 +alias sv_rcon_whitelist_address +rcon_password nodejs +alias rcon_password +hostport 21770 +alias rcon_password +net_start +con_logfile console.log`
4. DOWNLOAD THE CODE FROM THIS REPOSITORY AND OPEN IT IN YOUR TERMINAL
5. RUN `npm install`
6. RUN `npm start`
7. NOW YOU CAN RUN `?play <song name>` IN CHAT AND EVERYONE WILL HEAR YOUR MUSIC
