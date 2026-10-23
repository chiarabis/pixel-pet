// Configurazione di Electron Forge: `npm run make` crea l'installer Windows e lo zip portable in out/make/
import { readFileSync } from "node:fs";

// la versione viene da package.json, così il nome del Setup si aggiorna da solo
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default {
  packagerConfig: {
    // senza spazi: da qui prendono il nome la cartella nello zip e lo zip stesso (PixelPet-win32-x64-1.0.0.zip)
    name: "PixelPet",
    // nome dell'eseguibile (PixelPet.exe), senza spazi
    executableName: "PixelPet",
    icon: "./build/icon",
    asar: true,
    // Nell'app finale entrano solo package.json, electron/, dist/ (creata da `vite build`),
    // CREDITS.md, LICENSE e le dipendenze di runtime: tutto il resto è codice sorgente o strumenti di sviluppo.
    ignore: [
      /^\/src($|\/)/,
      /^\/build($|\/)/,
      /^\/scripts($|\/)/,
      // GIF e testi per la pagina GitHub: servono nel repository, non nell'app
      /^\/docs($|\/)/,
      /^\/README\.md$/,
      /^\/out($|\/)/,
      /^\/\.claude($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.gitignore$/,
      /^\/index\.html$/,
      /^\/vite\.config\.js$/,
      /^\/forge\.config\.js$/,
      /^\/package-lock\.json$/,
      // cache e file di servizio di Vite/npm dentro node_modules, inutili nell'app finale
      /^\/node_modules\/\.vite($|\/)/,
      /^\/node_modules\/\.vite-temp($|\/)/,
      /^\/node_modules\/\.package-lock\.json$/,
    ],
  },
  makers: [
    {
      // Installer: Pixel Pet Setup.exe (installa per utente, senza amministratore)
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "PixelPet", // nome del pacchetto: niente spazi
        setupExe: `PixelPet-Setup-${version}.exe`,
        setupIcon: "./build/icon.ico",
        noMsi: true,
      },
    },
    {
      // Versione portable: uno zip da decomprimere e avviare senza installare
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
    },
  ],
};
