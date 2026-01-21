const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('./app');
const connectDB = require('./config/db');

// =============================================================================
// SERVER STARTUP
// =============================================================================

const PORT = process.env.PORT || 3000;

/**
 * Start the server
 */
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        
        // Start Express server
        app.listen(PORT, () => {
            console.log('');
            console.log('╔═══════════════════════════════════════════════════════════╗');
            console.log('║                                                           ║');
            console.log('║   ██████╗ ██╗   ██╗██╗███████╗ ██████╗██████╗  █████╗ ███████╗████████╗  ║');
            console.log('║  ██╔═══██╗██║   ██║██║╚══███╔╝██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝  ║');
            console.log('║  ██║   ██║██║   ██║██║  ███╔╝ ██║     ██████╔╝███████║█████╗     ██║     ║');
            console.log('║  ██║▄▄ ██║██║   ██║██║ ███╔╝  ██║     ██╔══██╗██╔══██║██╔══╝     ██║     ║');
            console.log('║  ╚██████╔╝╚██████╔╝██║███████╗╚██████╗██║  ██║██║  ██║██║        ██║     ║');
            console.log('║   ╚══▀▀═╝  ╚═════╝ ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝     ║');
            console.log('║                                                           ║');
            console.log('╚═══════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`   ✓ Server running on http://localhost:${PORT}`);
            console.log(`   ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
