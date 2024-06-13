// Required modules
const { app, BrowserWindow, ipcMain } = require('electron')
const ytdlp = require('youtube-dl-exec')
const humanize = require('humanize-duration')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { getGamePath } = require('steam-game-path')
const RCON = require('rcon-srcds').default

// Define constants and file paths
const tf2 = getGamePath(440)
const logFilePath = path.join(tf2.game.path, 'tf', 'console.log')
const nircmdPath = path.join(__dirname, 'nircmd', 'nircmd.exe')

// Create RCON client instance
const rconClient = new RCON({
    host: '127.0.0.1',
    port: 21770
})

// Event emitter for authentication
const authEvent = new (require('events').EventEmitter)()

// Define global variables
let window
let currentSong
let skipVotes = 0
let alreadyVoteSkipped = []
let queue = []

// Functions

/**
 * Authenticates the RCON client and performs post-authentication actions.
 */
async function authenticate() {
    try {
        await rconClient.authenticate('nodejs')
        authEvent.emit('authenticated')
        fixMicrophone()
        return { code: 'success' }
    } catch (error) {
        return { code: error.code }
    }
}

/**
 * Sends a message to the team or general chat using an RCON client.
 * @param {Object} param - The parameter object.
 * @param {string} param.text - The text to be sent as a message.
 * @param {boolean} param.team - If true, the message is sent to the team chat; otherwise, it is sent to the global chat.
 */
async function say({ text, team }) {
    try {
        const command = team ? `say_team ${text}` : `say ${text}`
        await rconClient.execute(command)
    } catch (error) {
        console.error(error)
    }
}

/**
 * Searches for a video on YouTube and returns its details.
 * @param {string} queryName - The name of the video to search for.
 * @returns {Object} An object containing video details.
 */
async function search(queryName) {
    try {
        console.log(`Searching for "${queryName}"...`)

        say({ text: `Searching for "${queryName}"...`, team: true })

        const video = await ytdlp(queryName, {
            dumpJson: true,
            defaultSearch: 'ytsearch',
            noPlaylist: true,
            extractAudio: true,
            audioFormat: 'mp3',
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
            referer: 'https://google.com'
        })

        const humanDuration = humanize(video.duration * 1000)
        console.log(`Found video: ${video.title} - ${video.channel} (${humanDuration})`)

        return {
            title: video.title,
            channel: video.channel,
            url: video.webpage_url,
            id: video.id,
            duration: {
                seconds: video.duration,
                humanized: humanDuration
            },
            audio: {
                url: video.url
            }
        }
    } catch (error) {
        console.error(error)
    }
}

/**
 * Skips the current song and plays the next song in the queue if available.
 */
async function skipCurrentSong() {
    queue = queue.filter(item => item !== currentSong)

    if (queue.length > 0) {
        currentSong = queue[0]
        window.webContents.send('changeSong', currentSong)
    } else {
        currentSong = undefined
    }
}

/**
 * Searches for a song based on the query, adds it to the queue, and plays it if it's the first in the queue.
 * @param {string} query - The search query to find the song.
 */
async function playSong(query) {
    const song = await search(query)

    queue.push(song)

    if (queue.indexOf(song) === 0) {
        currentSong = song
        window.webContents.send('changeSong', song)
    } else {
        say({ text: `Added ${song.title} to queue`, team: true })
    }
}

/**
 * Fixes the microphone settings by setting the default sound device and executing voice commands via the RCON client.
 */
async function fixMicrophone() {
    // Set default sound device
    exec(`"${nircmdPath}" setdefaultsounddevice "CABLE Output" 1`, async function (error, stdout, stderr) {
        if (error) return console.error(`Error setting default microphone: ${error.message}`)
        if (stderr) return console.error(`stderr: ${stderr}`)
        console.log('Default microphone set successfully.')

        await rconClient.execute('voice_loopback 1')
        await rconClient.execute('voice_buffer_ms 200')

        await rconClient.execute('-voicerecord')
        setTimeout(async function () {
            await rconClient.execute('+voicerecord')
        }, 1000)
    })
}

/**
 * Main function to start the application.
 */
async function main() {
    // Retry connection until successful
    let connectInterval = setInterval(async function () {
        const auth = await authenticate()

        if (auth.code === 'ECONNREFUSED') {
            console.log('Failed to connect to RCON, retrying in 5 seconds...')
        } else if (auth.code === 'success') {
            console.log('Successfully connected to RCON')
            clearInterval(connectInterval)
        }
    }, 5000)

    setInterval(async function () {
        await rconClient.execute('+voicerecord')
    }, 3000)

    // After authentication, start listening to console log file
    authEvent.on('authenticated', function () {
        fs.watchFile(logFilePath, async function () {
            const content = fs.readFileSync(logFilePath, { encoding: 'utf-8' })

            let array = content.split('\r\n')

            for (let line of array) {
                const sanitizedLine = line.replace(/[^a-zA-Z0-9 ?:/&.=]/g, '')

                if (sanitizedLine.includes('?play ')) {
                    array = array.filter(aline => aline !== line)
                    fs.writeFileSync(logFilePath, array.join('\r\n'))
                    
                    const query = sanitizedLine.split('?play ')[1]
                    await playSong(query)
                }

                if (sanitizedLine.includes('?skip')) {
                    array = array.filter(aline => aline !== line)
                    fs.writeFileSync(logFilePath, array.join('\r\n'))

                    if (!currentSong) return

                    let username = sanitizedLine.split('?skip')[0]
                    let sanitizedUsername = username.replace(/[ :]/g, '')

                    if (!(alreadyVoteSkipped.includes(sanitizedUsername))) {
                        skipVotes++
                    }

                    alreadyVoteSkipped.push(sanitizedUsername)

                    if (skipVotes < 4) {
                        say({ text: `${sanitizedUsername} wants to skip this song (${skipVotes}/4)` })
                    } else {
                        alreadyVoteSkipped = []
                        skipVotes = 0
                        say({ text: 'Skipping song.', team: true })
                        setTimeout(skipCurrentSong, 2000)
                    }
                }
            }
        })
    })
}

app.whenReady().then(function () {
    window = new BrowserWindow({
        width: 350,
        height: 150,
        autoHideMenuBar: true,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'electron', 'preload.js')
        }
    })

    ipcMain.on('songPlaying', async function () {
        say({ text: `Now playing: ${currentSong.title} - ${currentSong.channel} (${currentSong.duration.humanized})`, team: true })
    })

    ipcMain.on('songFinished', async function () {
        say({ text: `${currentSong.title} has finished playing.` })
        setTimeout(skipCurrentSong, 2000)
    })

    ipcMain.on('skipSong', async function () {
        say({ text: 'Skipping song.', team: true })
        setTimeout(skipCurrentSong, 2000)
    })

    ipcMain.on('fixMicrophone', async function () {
        fixMicrophone()
    })

    window.loadFile(path.join(__dirname, 'electron', 'index.html'))

    window.webContents.once('did-finish-load', main)
})