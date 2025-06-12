require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 4444;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ping test
app.get('/ping', (req, res) => {
    res.json({ status: 'pong', timestamp: new Date().toISOString() });
});

// Handle both GET and POST for GPS data (GPS Logger can use either)
app.all('/gps', async (req, res) => {
    console.log(`GPS endpoint hit - Method: ${req.method}`);
    const startTime = Date.now(); // Fixed: was missing parentheses
    
    // Debug: Log what we received
    console.log('Query params:', req.query);
    console.log('Request body:', req.body);
    
    try {
        const gpsData = extractGPSData(req);
        
        if (!gpsData.latitude || !gpsData.longitude) {
            console.log('Missing required GPS coordinates');
            return res.status(400).json({ 
                error: 'Missing latitude or longitude',
                received: {
                    query: req.query,
                    body: req.body,
                    method: req.method
                }
            });
        }
        
        console.log('GPS Data received:', gpsData);
        
        // Process the GPS data
        await ProcessData(gpsData);
        
        const processingTime = Date.now() - startTime;
        console.log(`GPS data processed in ${processingTime}ms`);
        
        // Send success response
        res.json({ 
            status: 'success', 
            timestamp: new Date().toISOString(),
            processingTime: `${processingTime}ms`,
            location: {
                lat: gpsData.latitude,
                lon: gpsData.longitude
            }
        });
        
    } catch (error) {
        console.error('Error processing GPS data:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Keep your original /GPS endpoint for backward compatibility
app.post('/GPS', async (req, res) => {
    // Redirect to the main /gps endpoint
    req.url = '/gps';
    app._router.handle(req, res);
});

function extractGPSData(req) {
    const data = req.method === 'GET' ? req.query : req.body;
    
    return {
        latitude: parseFloat(data.lat || data.latitude),
        longitude: parseFloat(data.lon || data.lng || data.longitude),
        timestamp: data.time || data.timestamp || new Date().toISOString(),
        accuracy: parseFloat(data.acc || data.accuracy) || null,
        altitude: parseFloat(data.alt || data.altitude) || null,
        speed: parseFloat(data.spd || data.speed) || null,
        bearing: parseFloat(data.dir || data.bearing) || null,
        satellites: parseInt(data.sat || data.satellites) || null,
        battery: parseFloat(data.batt || data.battery) || null,
        provider: data.prov || data.provider || 'unknown',
        deviceId: data.device || data.deviceId || 'unknown',
        raw: data // Keep original data for debugging
    };
}

// Your ProcessData function - implement your custom logic here
// async function ProcessData(gpsData) {
//     console.log(`Processing GPS coordinates: ${gpsData.latitude}, ${gpsData.longitude}`);
    
//     // Example processing tasks:
    
//     // 1. Log to console with formatted output
//     console.log(`📍 Location: ${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}`);
//     if (gpsData.accuracy) console.log(`🎯 Accuracy: ${gpsData.accuracy}m`);
//     if (gpsData.speed) console.log(`🚗 Speed: ${(gpsData.speed * 3.6).toFixed(1)} km/h`);
//     if (gpsData.altitude) console.log(`⛰️  Altitude: ${gpsData.altitude}m`);
    
//     // 2. Forward to external API (if configured)
//     if (process.env.WEBHOOK_URL) {
//         try {
//             await axios.post(process.env.WEBHOOK_URL, {
//                 location: {
//                     latitude: gpsData.latitude,
//                     longitude: gpsData.longitude,
//                     timestamp: gpsData.timestamp
//                 },
//                 metadata: {
//                     accuracy: gpsData.accuracy,
//                     speed: gpsData.speed,
//                     altitude: gpsData.altitude,
//                     device: gpsData.deviceId
//                 }
//             }, {
//                 timeout: 5000,
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': process.env.WEBHOOK_TOKEN ? `Bearer ${process.env.WEBHOOK_TOKEN}` : undefined
//                 }
//             });
//             console.log('✅ Data forwarded to webhook');
//         } catch (error) {
//             console.error('❌ Failed to forward to webhook:', error.message);
//         }
//     }
    
//     // 3. Check if location is within specific bounds (example: Joinville, SC area)
//     const joinvilleBounds = {
//         north: -26.2,
//         south: -26.4,
//         east: -48.7,
//         west: -48.9
//     };
    
//     if (gpsData.latitude > joinvilleBounds.south && 
//         gpsData.latitude < joinvilleBounds.north &&
//         gpsData.longitude > joinvilleBounds.west && 
//         gpsData.longitude < joinvilleBounds.east) {
//         console.log('📍 Location is in Joinville area');
//     }
    
//     // 4. Calculate distance from a reference point (example: your home/office)
//     const referencePoint = {
//         lat: parseFloat(process.env.HOME_LAT || '-26.3044'),  // Joinville center
//         lon: parseFloat(process.env.HOME_LON || '-48.8487')
//     };
    
//     const distance = calculateDistance(
//         gpsData.latitude, gpsData.longitude,
//         referencePoint.lat, referencePoint.lon
//     );
    
//     console.log(`📏 Distance from reference point: ${(distance/1000).toFixed(2)} km`);
    
//     // 5. Store in memory for basic tracking (you could replace with database)
//     if (!global.locationHistory) global.locationHistory = [];
//     global.locationHistory.push({
//         ...gpsData,
//         serverTimestamp: new Date().toISOString()
//     });
    
//     // Keep only last 100 locations in memory
//     if (global.locationHistory.length > 100) {
//         global.locationHistory = global.locationHistory.slice(-100);
//     }
    
//     console.log(`💾 Stored location (${global.locationHistory.length} total)`);
// }

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Get recent locations endpoint
app.get('/locations', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const locations = global.locationHistory || [];
    
    res.json({
        count: locations.length,
        locations: locations.slice(-limit),
        latest: locations[locations.length - 1] || null
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        locationsStored: global.locationHistory ? global.locationHistory.length : 0,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        availableEndpoints: ['/ping', '/gps', '/GPS', '/locations', '/health']
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GPS Logger Server running on port ${PORT}`);
    console.log(`📍 Available endpoints:`);
    console.log(`   GET/POST /gps      - Receive GPS data`);
    console.log(`   POST     /GPS      - Legacy GPS endpoint`);
    console.log(`   GET      /ping     - Health check`);
    console.log(`   GET      /locations- View stored locations`);
    console.log(`   GET      /health   - Server statistics`);
    console.log(`\n🔧 Environment variables you can set:`);
    console.log(`   WEBHOOK_URL    - Forward GPS data to external API`);
    console.log(`   WEBHOOK_TOKEN  - Authorization token for webhook`);
    console.log(`   HOME_LAT       - Reference latitude for distance calc`);
    console.log(`   HOME_LON       - Reference longitude for distance calc`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});