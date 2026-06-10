const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
    try {
        const tunnel = await localtunnel({ port: 3000 });
        fs.writeFileSync('tunnel_url.txt', tunnel.url);
        
        tunnel.on('close', () => {
            console.log('Túnel cerrado.');
        });
    } catch (err) {
        console.error('Error al iniciar el túnel:', err);
    }
})();
