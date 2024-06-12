const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
    songPlaying: function () {
        ipcRenderer.send('songPlaying')
    },
    songFinished: function () {
        ipcRenderer.send('songFinished')
    },
    skipSong: function () {
        ipcRenderer.send('skipSong')
    },
    fixMicrophone: function () {
        ipcRenderer.send('fixMicrophone')
    },
    changeSong: function (callback) {
        ipcRenderer.on('changeSong', (_event, value) => callback(value))
    }
})