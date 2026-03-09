// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: true,   // ← add this line
//     port: 5173,
//   }
// })


// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import os from 'os'

// function getLocalIP() {
//   const nets = os.networkInterfaces();
//   for (const name of Object.keys(nets)) {
//     for (const net of nets[name]) {
//       if (net.family === 'IPv4' && !net.internal) {
//         return net.address;
//       }
//     }
//   }
//   return 'localhost';
// }

// const localIP = "192.168.111.1";

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: true,
//     port: 5173,
//   },
//   define: {
//     __LOCAL_IP__: JSON.stringify(localIP),
//   }
// })

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

function getLocalIP() {
  const nets = os.networkInterfaces();
  const skip = ['vmware', 'vnet', 'virtual', 'warp', 'loopback', 'tunnel', 'bluetooth'];
  
  for (const name of Object.keys(nets)) {
    const nameLower = name.toLowerCase();
    // Skip virtual/VPN adapters
    if (skip.some(s => nameLower.includes(s))) continue;
    
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
console.log('Detected local IP:', localIP); // shows in terminal so you can verify

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  define: {
    __LOCAL_IP__: JSON.stringify(localIP),
  }
})