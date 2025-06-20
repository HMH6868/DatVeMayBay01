const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add logging middleware to debug API requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Database setup
let db;
async function setupDatabase() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS flights (
            flight_id INTEGER PRIMARY KEY AUTOINCREMENT,
            airline TEXT NOT NULL,
            airline_code TEXT NOT NULL,
            flight_number TEXT NOT NULL,
            departure_airport TEXT NOT NULL,
            arrival_airport TEXT NOT NULL,
            departure_time DATETIME NOT NULL,
            arrival_time DATETIME NOT NULL,
            duration TEXT NOT NULL,
            price_economy REAL NOT NULL,
            price_premium_economy REAL,
            price_business REAL,
            price_first REAL,
            seats_economy INTEGER NOT NULL,
            seats_premium_economy INTEGER,
            seats_business INTEGER,
            seats_first INTEGER,
            available_seats INTEGER NOT NULL,  -- Total count (kept for backward compatibility)
            status TEXT DEFAULT 'scheduled',
            available_classes TEXT NOT NULL
        );

        -- Bảng USERS để lưu thông tin người dùng
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'blocked'))
        );

        -- Bảng USER_SESSIONS để lưu phiên đăng nhập
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            expire_time DATETIME NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        );

        -- Bảng BOOKINGS with round-trip support
        CREATE TABLE IF NOT EXISTS bookings (
            booking_id TEXT PRIMARY KEY,
            user_id INTEGER,                        -- Foreign key to users table (can be NULL for guest bookings)
            departure_flight_id INTEGER NOT NULL,
            return_flight_id INTEGER,               -- Null for one-way trips
            contact_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            travel_class TEXT NOT NULL,             -- Hạng vé được chọn (economy/business)
            total_amount REAL NOT NULL,
            booking_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            payment_status TEXT DEFAULT 'unpaid',
            promo_code TEXT,                        -- Mã khuyến mãi nếu có
            passengers_info TEXT,                   -- Additional passenger information
            is_round_trip BOOLEAN DEFAULT 0,        -- Flag to indicate if this is a round-trip booking
            should_refund BOOLEAN DEFAULT 0,        -- Flag to indicate if a refund should be processed
            cancelled_by_admin BOOLEAN DEFAULT 0,   -- Flag to indicate if cancellation was done by admin
            FOREIGN KEY (user_id) REFERENCES users(user_id),
            FOREIGN KEY (departure_flight_id) REFERENCES flights(flight_id),
            FOREIGN KEY (return_flight_id) REFERENCES flights(flight_id)
        );
    `);

    // Add migration check for the should_refund column
    try {
        // Check if should_refund column exists in the bookings table
        const tableInfo = await db.all('PRAGMA table_info(bookings)');
        const hasSholdRefundColumn = tableInfo.some(column => column.name === 'should_refund');
        const hasCancelledByAdminColumn = tableInfo.some(column => column.name === 'cancelled_by_admin');
        
        // Add the columns if they don't exist
        if (!hasSholdRefundColumn) {
            console.log('Adding should_refund column to bookings table...');
            await db.exec('ALTER TABLE bookings ADD COLUMN should_refund BOOLEAN DEFAULT 0');
            console.log('should_refund column added successfully');
        }
        
        if (!hasCancelledByAdminColumn) {
            console.log('Adding cancelled_by_admin column to bookings table...');
            await db.exec('ALTER TABLE bookings ADD COLUMN cancelled_by_admin BOOLEAN DEFAULT 0');
            console.log('cancelled_by_admin column added successfully');
        }
    } catch (migrationError) {
        console.error('Error during database migration:', migrationError);
    }

    // Continue with the rest of the setup
    await db.exec(`
        -- Bảng BOOKING_DETAILS
        CREATE TABLE IF NOT EXISTS booking_details (            
            detail_id INTEGER PRIMARY KEY AUTOINCREMENT,            
            booking_id TEXT NOT NULL,            
            full_name TEXT NOT NULL,            
            gender TEXT,            
            dob TEXT,            
            passport_number TEXT NOT NULL,            
            passenger_type TEXT DEFAULT 'ADULT',    -- Loại hành khách: ADULT, CHILD, INFANT            
            luggage_weight REAL DEFAULT 0,          -- Số kg hành lý ký gửi (nếu có)            
            insurance BOOLEAN DEFAULT 0,            -- Có mua bảo hiểm không            
            meal BOOLEAN DEFAULT 0,                 -- Có suất ăn đặc biệt không            
            FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)        
        );

        -- Bảng PAYMENTS
        CREATE TABLE IF NOT EXISTS payments (
            booking_id TEXT PRIMARY KEY,
            method TEXT NOT NULL CHECK (method IN ('bank_transfer', 'momo')),
            transaction_info TEXT, -- Tùy chọn: có thể là tên người chuyển khoản hoặc số điện thoại MoMo
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        );

        -- Bảng PROMOTIONS
        CREATE TABLE IF NOT EXISTS promotions (
            promo_id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,              -- Mã khuyến mãi (VD: SUMMER25)
            name TEXT NOT NULL,                     -- Tên khuyến mãi
            description TEXT,
            discount_type TEXT CHECK(discount_type IN ('percent', 'fixed')) NOT NULL,
            discount_value REAL NOT NULL,
            valid_from TEXT,
            valid_to TEXT,
            usage_limit INTEGER,
            used_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'scheduled', 'expired'))
        );
    `);

    // Check if we have flights in the database
    const count = await db.get('SELECT COUNT(*) as count FROM flights');
    if (count.count === 0) {
        console.log('Populating database with sample flights...');
        await populateSampleFlights();
    }

    // Check if we have any promotions in the database
    const promoCount = await db.get('SELECT COUNT(*) as count FROM promotions');
    if (promoCount.count === 0) {
        console.log('Adding sample promotions...');
        await populateSamplePromotions();
    }
}

// API endpoints
// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
    console.log('Test endpoint called');
    res.json({ status: 'API is working', timestamp: new Date().toISOString() });
});

// New endpoint with a different path to avoid conflicts
app.get('/api/user/bookings', async (req, res) => {
    console.log('GET /api/user/bookings endpoint called');
    try {
        const sessionId = req.headers.authorization;
        console.log('Session ID:', sessionId);
        
        if (!sessionId) {
            console.log('No session ID provided');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if session exists and is valid
        const session = await db.get(
            'SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1 AND expire_time > CURRENT_TIMESTAMP',
            [sessionId]
        );
        console.log('Session found:', session ? 'Yes' : 'No');
        
        if (!session) {
            console.log('Invalid or expired session');
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        console.log('User ID from session:', session.user_id);
        
        // Get user's bookings
        const bookings = await db.all('SELECT * FROM bookings WHERE user_id = ? ORDER BY booking_time DESC', [session.user_id]);
        console.log(`Found ${bookings.length} bookings for user`);
        
        // Format bookings data for the client
        const formattedBookings = [];
        
        for (const booking of bookings) {
            console.log(`Processing booking ID: ${booking.booking_id}`);
            try {
                // Get departure flight
                const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
                
                // Get return flight if this is a round trip
                let returnFlight = null;
                if (booking.is_round_trip === 1 && booking.return_flight_id) {
                    returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.return_flight_id]);
                }
                
                // Get passengers
                const passengers = await db.all('SELECT * FROM booking_details WHERE booking_id = ?', [booking.booking_id]);
                console.log(`Found ${passengers.length} passengers for booking ${booking.booking_id}`);
                
                // Format the booking data
                const formattedBooking = {
                    id: booking.booking_id,
                    bookingNumber: booking.booking_id,
                    status: booking.payment_status,
                    bookingDate: booking.booking_time,
                    totalPrice: booking.total_amount,
                    flights: [
                        {
                            type: 'outbound',
                            flightNumber: departureFlight ? `${departureFlight.airline_code}${departureFlight.flight_number}` : 'N/A',
                            airline: departureFlight ? departureFlight.airline : 'N/A',
                            departureCode: departureFlight ? departureFlight.departure_airport : 'N/A',
                            arrivalCode: departureFlight ? departureFlight.arrival_airport : 'N/A',
                            departureTime: departureFlight ? departureFlight.departure_time : null,
                            arrivalTime: departureFlight ? departureFlight.arrival_time : null,
                            seatClass: booking.travel_class
                        }
                    ],
                    passengers: passengers.map(p => ({
                        name: p.full_name,
                        type: p.passenger_type.toLowerCase(),
                        passportNumber: p.passport_number
                    })),
                    contactInfo: {
                        name: booking.contact_name,
                        email: booking.email,
                        phone: booking.phone
                    },
                    payment: {
                        method: booking.payment_method || 'N/A',
                        status: booking.payment_status
                    }
                };
                
                // Add return flight if exists
                if (returnFlight) {
                    formattedBooking.flights.push({
                        type: 'return',
                        flightNumber: `${returnFlight.airline_code}${returnFlight.flight_number}`,
                        airline: returnFlight.airline,
                        departureCode: returnFlight.departure_airport,
                        arrivalCode: returnFlight.arrival_airport,
                        departureTime: returnFlight.departure_time,
                        arrivalTime: returnFlight.arrival_time,
                        seatClass: booking.travel_class
                    });
                }
                
                formattedBookings.push(formattedBooking);
            } catch (bookingError) {
                console.error(`Error processing booking ${booking.booking_id}:`, bookingError);
                // Continue with the next booking
            }
        }
        
        console.log(`Returning ${formattedBookings.length} formatted bookings`);
        res.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
    }
});

app.get('/api/flights', async (req, res) => {
    try {
        const { departure, destination, departDate, seatClass, status } = req.query;
        
        let query = 'SELECT * FROM flights WHERE 1=1';
        const params = [];

        if (departure) {
            query += ' AND departure_airport = ?';
            params.push(departure);
        }

        if (destination) {
            query += ' AND arrival_airport = ?';
            params.push(destination);
        }

        if (departDate) {
            // Convert YYYY-MM-DD to date format in the database
            const formattedDate = formatDateForDB(departDate);
            query += ' AND DATE(departure_time) = ?';
            params.push(formattedDate);
        }

        if (seatClass) {
            query += ' AND available_classes LIKE ?';
            params.push(`%${seatClass}%`);
        }
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        const flights = await db.all(query, params);
        
        // Format flights for client
        const formattedFlights = flights.map(formatFlightForClient);
        
        res.json(formattedFlights);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

app.get('/api/flights/:id', async (req, res) => {
    try {
        const flight = await db.get('SELECT * FROM flights WHERE flight_id = ?', req.params.id);
        
        if (!flight) {
            return res.status(404).json({ error: 'Flight not found' });
        }
        
        res.json(formatFlightForClient(flight));
    } catch (error) {
        console.error('Error fetching flight:', error);
        res.status(500).json({ error: 'Failed to fetch flight details' });
    }
});

// Admin API: Create a new flight
app.post('/api/flights', async (req, res) => {
    try {
        const { 
            airline, airline_code, flight_number, 
            departure_airport, arrival_airport, 
            departure_time, arrival_time, 
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            status, available_classes 
        } = req.body;

        // Validate required fields
        if (!airline || !airline_code || !flight_number || 
            !departure_airport || !arrival_airport || 
            !departure_time || !arrival_time || 
            !price_economy || !seats_economy || !available_classes) {
            return res.status(400).json({ error: 'Missing required flight information' });
        }

        // Calculate duration
        const deptTime = new Date(departure_time);
        const arrTime = new Date(arrival_time);
        const durationMs = arrTime - deptTime;
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${durationHours}h ${durationMinutes}m`;

        // available_classes có thể là mảng hoặc chuỗi, đảm bảo lưu là chuỗi
        const availableClassesString = Array.isArray(available_classes) 
            ? available_classes.join(',') 
            : available_classes;

        // Insert new flight
        const result = await db.run(`
            INSERT INTO flights (
                airline, airline_code, flight_number, departure_airport, arrival_airport, 
                departure_time, arrival_time, duration,
                price_economy, price_premium_economy, price_business, price_first,
                seats_economy, seats_premium_economy, seats_business, seats_first,
                available_seats, status, available_classes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            airline, airline_code, flight_number, departure_airport, arrival_airport, 
            departure_time, arrival_time, duration,
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            total_seats, status || 'scheduled', availableClassesString
        ]);

        const newFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [result.lastID]);
        res.status(201).json(formatFlightForClient(newFlight));
    } catch (error) {
        console.error('Error creating flight:', error);
        res.status(500).json({ error: 'Failed to create flight', details: error.message });
    }
});

// Admin API: Update a flight
app.put('/api/flights/:id', async (req, res) => {
    try {
        const flightId = req.params.id;
        const { 
            airline, airline_code, flight_number, 
            departure_airport, arrival_airport, 
            departure_time, arrival_time, 
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            available_seats, status, 
            available_classes 
        } = req.body;

        // Validate required fields
        if (!airline || !airline_code || !flight_number || 
            !departure_airport || !arrival_airport || 
            !departure_time || !arrival_time || 
            !price_economy || !available_seats || !available_classes) {
            return res.status(400).json({ error: 'Missing required flight information' });
        }

        // Check if flight exists
        const existingFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', flightId);
        if (!existingFlight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Calculate duration
        const deptTime = new Date(departure_time);
        const arrTime = new Date(arrival_time);
        const durationMs = arrTime - deptTime;
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${durationHours}h ${durationMinutes}m`;

        // available_classes có thể là mảng hoặc chuỗi, đảm bảo lưu là chuỗi
        const availableClassesString = Array.isArray(available_classes) 
            ? available_classes.join(',') 
            : available_classes;

        console.log('Updating flight with ID:', flightId);
        console.log('Data received:', req.body);

        // Update the flight
        await db.run(`
            UPDATE flights SET
                airline = ?, airline_code = ?, flight_number = ?,
                departure_airport = ?, arrival_airport = ?,
                departure_time = ?, arrival_time = ?, duration = ?,
                price_economy = ?, price_premium_economy = ?, price_business = ?, price_first = ?,
                seats_economy = ?, seats_premium_economy = ?, seats_business = ?, seats_first = ?,
                available_seats = ?, status = ?, available_classes = ?
            WHERE flight_id = ?
        `, [
            airline, airline_code, flight_number,
            departure_airport, arrival_airport,
            departure_time, arrival_time, duration,
            price_economy, price_premium_economy || null, price_business || null, price_first || null,
            seats_economy || 0, seats_premium_economy || 0, seats_business || 0, seats_first || 0,
            available_seats, status, availableClassesString,
            flightId
        ]);

        // Get the updated flight
        const updatedFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', flightId);
        
        console.log('Updated flight:', updatedFlight);
        res.json(formatFlightForClient(updatedFlight));
    } catch (error) {
        console.error('Error updating flight:', error);
        res.status(500).json({ error: 'Failed to update flight', details: error.message });
    }
});

// Admin API: Update a flight by flight code
app.put('/api/flights/code/:flightCode', async (req, res) => {
    try {
        const flightCode = req.params.flightCode;
        const { 
            airline, airline_code, flight_number, 
            departure_airport, arrival_airport, 
            departure_time, arrival_time, 
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            status, available_classes 
        } = req.body;

        // Validate required fields
        if (!airline || !airline_code || !flight_number || 
            !departure_airport || !arrival_airport || 
            !departure_time || !arrival_time || 
            !price_economy || !seats_economy || !available_classes) {
            return res.status(400).json({ error: 'Missing required flight information' });
        }

        // Calculate duration
        const deptTime = new Date(departure_time);
        const arrTime = new Date(arrival_time);
        const durationMs = arrTime - deptTime;
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${durationHours}h ${durationMinutes}m`;

        // Calculate total available seats
        const total_seats = (seats_economy || 0) + 
                           (seats_premium_economy || 0) + 
                           (seats_business || 0) + 
                           (seats_first || 0);

        // Ensure available_classes is in the right format
        const availableClassesString = Array.isArray(available_classes) 
            ? available_classes.join(',') 
            : available_classes;

        // Find the flight by code
        const existingFlight = await db.get(
            'SELECT * FROM flights WHERE airline_code || flight_number = ?', 
            [flightCode]
        );

        if (!existingFlight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Update the flight
        await db.run(`
            UPDATE flights SET
                airline = ?, airline_code = ?, flight_number = ?,
                departure_airport = ?, arrival_airport = ?,
                departure_time = ?, arrival_time = ?, duration = ?,
                price_economy = ?, price_premium_economy = ?, price_business = ?, price_first = ?,
                seats_economy = ?, seats_premium_economy = ?, seats_business = ?, seats_first = ?,
                available_seats = ?, status = ?, available_classes = ?
            WHERE flight_id = ?
        `, [
            airline, airline_code, flight_number,
            departure_airport, arrival_airport,
            departure_time, arrival_time, duration,
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            total_seats, status, availableClassesString,
            existingFlight.flight_id
        ]);

        const updatedFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [existingFlight.flight_id]);
        res.json(formatFlightForClient(updatedFlight));
    } catch (error) {
        console.error('Error updating flight:', error);
        res.status(500).json({ error: 'Failed to update flight', details: error.message });
    }
});

// Admin API: Delete a flight
app.delete('/api/flights/:id', async (req, res) => {
    try {
        const flightId = req.params.id;

        // Check if flight exists
        const existingFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', flightId);
        if (!existingFlight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Check if flight has bookings
        const bookings = await db.get('SELECT COUNT(*) as count FROM bookings WHERE flight_id = ?', flightId);
        if (bookings.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete flight with existing bookings',
                bookingsCount: bookings.count
            });
        }

        // Delete the flight
        await db.run('DELETE FROM flights WHERE flight_id = ?', flightId);
        
        res.json({ message: 'Flight deleted successfully' });
    } catch (error) {
        console.error('Error deleting flight:', error);
        res.status(500).json({ error: 'Failed to delete flight' });
    }
});

// Admin API: Delete a flight by code
app.delete('/api/flights/code/:flightCode', async (req, res) => {
    try {
        const flightCode = req.params.flightCode;
        
        // Extract airline code and flight number from flightCode
        let airlineCode = '';
        let flightNum = '';
        
        // Common format is 2 letters followed by numbers (e.g., VN1000)
        const match = flightCode.match(/^([A-Z]+)(\d+)$/);
        if (match) {
            airlineCode = match[1];
            flightNum = match[2];
        } else {
            // Fallback to the whole code
            airlineCode = flightCode;
        }

        // Check if flight exists
        const existingFlight = await db.get('SELECT * FROM flights WHERE airline_code = ? AND flight_number = ?', [airlineCode, flightNum]);
        if (!existingFlight) {
            return res.status(404).json({ error: 'Flight not found' });
        }

        // Check if flight has bookings
        const bookings = await db.get('SELECT COUNT(*) as count FROM bookings WHERE flight_id = ?', existingFlight.flight_id);
        if (bookings.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete flight with existing bookings',
                bookingsCount: bookings.count
            });
        }

        // Delete the flight
        await db.run('DELETE FROM flights WHERE flight_id = ?', existingFlight.flight_id);
        
        res.json({ message: 'Flight deleted successfully' });
    } catch (error) {
        console.error('Error deleting flight:', error);
        res.status(500).json({ error: 'Failed to delete flight', details: error.message });
    }
});

// Admin API: Flight statistics
app.get('/api/admin/stats/flights', async (req, res) => {
    try {
        // Get flight count by status
        const statusStats = await db.all(`
            SELECT status, COUNT(*) as count 
            FROM flights 
            GROUP BY status 
            ORDER BY count DESC
        `);
        
        // Get total bookings count
        const totalBookings = await db.get(`
            SELECT COUNT(*) as count 
            FROM bookings
        `);
        
        // Get upcoming flights count (next 24 hours)
        const upcomingFlights = await db.get(`
            SELECT COUNT(*) as count 
            FROM flights 
            WHERE departure_time BETWEEN datetime('now') AND datetime('now', '+24 hours')
            AND status IN ('scheduled', 'boarding')
        `);
        
        // Get most popular routes
        const popularRoutes = await db.all(`
            SELECT departure_airport, arrival_airport, COUNT(*) as count 
            FROM flights
            GROUP BY departure_airport, arrival_airport
            ORDER BY count DESC
            LIMIT 5
        `);
        
        // Get bookings by travel class
        const bookingsByClass = await db.all(`
            SELECT travel_class, COUNT(*) as count 
            FROM bookings 
            GROUP BY travel_class
        `);
        
        res.json({
            flightsByStatus: statusStats,
            totalBookings: totalBookings.count,
            upcomingFlights: upcomingFlights.count,
            popularRoutes,
            bookingsByClass
        });
    } catch (error) {
        console.error('Error fetching flight statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Additional API endpoints for booking
app.post('/api/bookings', async (req, res) => {
    try {
        // Support both naming conventions
        const { 
            departureFlightId, 
            departure_flight_id,
            returnFlightId,
            return_flight_id,
            isRoundTrip,
            is_round_trip,
            customerInfo, 
            passengers, 
            selectedServices, 
            promoCode, 
            totalAmount, 
            passengerCounts, 
            paymentMethod, 
            transactionInfo,
            userId // Extract userId from the request body
        } = req.body;

        // Use the data regardless of which field name was used
        const finalDepartureFlightId = departureFlightId || departure_flight_id;
        const finalReturnFlightId = returnFlightId || return_flight_id;
        const finalIsRoundTrip = isRoundTrip || is_round_trip;
        
        // Log the request for debugging
        console.log('Booking Request:', { 
            departureFlightId: finalDepartureFlightId, 
            returnFlightId: finalReturnFlightId, 
            isRoundTrip: finalIsRoundTrip,
            customerInfo, 
            passengersCount: passengers?.length,
            userId // Log userId
        });
        
        // Validate required fields with better error messages
        const missingFields = [];
        if (!finalDepartureFlightId) missingFields.push('departureFlightId');
        if (!customerInfo) missingFields.push('customerInfo');
        if (!passengers || passengers.length === 0) missingFields.push('passengers');
        
        if (missingFields.length > 0) {
            console.error('Missing required booking information:', missingFields);
            return res.status(400).json({ 
                error: 'Missing required booking information', 
                missingFields: missingFields,
                receivedData: {
                    hasDepartureFlightId: !!finalDepartureFlightId,
                    hasCustomerInfo: !!customerInfo,
                    passengersCount: passengers?.length || 0
                }
            });
        }
        
        // Get departure flight details - check by both ID and flight number
        let departureFlight = null;
        // Try to find by flight_id (database id) first
        if (!isNaN(finalDepartureFlightId)) {
            departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [finalDepartureFlightId]);
        }
        
        // If not found, try by airline_code + flight_number (display id)
        if (!departureFlight) {
            departureFlight = await db.get('SELECT * FROM flights WHERE (airline_code || flight_number) = ?', [finalDepartureFlightId]);
        }
        
        if (!departureFlight) {
            return res.status(404).json({ 
                error: 'Departure flight not found', 
                providedId: finalDepartureFlightId,
                lookupType: isNaN(finalDepartureFlightId) ? 'display_id' : 'database_id'
            });
        }

        // Get return flight details if this is a round trip
        let returnFlight = null;
        
        if (finalIsRoundTrip && finalReturnFlightId) {
            // Try to find by flight_id (database id) first
            if (!isNaN(finalReturnFlightId)) {
                returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [finalReturnFlightId]);
            }
            
            // If not found, try by airline_code + flight_number (display id)
            if (!returnFlight) {
                returnFlight = await db.get('SELECT * FROM flights WHERE (airline_code || flight_number) = ?', [finalReturnFlightId]);
            }
            
            if (!returnFlight) {
                return res.status(404).json({ 
                    error: 'Return flight not found',
                    providedId: finalReturnFlightId,
                    lookupType: isNaN(finalReturnFlightId) ? 'display_id' : 'database_id'
                });
            }
        }

        // Check if enough seats are available for departure flight based on seat class
        const totalPassengers = passengers.length;
        const seatClass = customerInfo.seatClass || 'ECONOMY';

        // Determine which seat field to check based on the seat class
        let seatField, seatValue;
        switch(seatClass) {
            case 'PREMIUM_ECONOMY':
                seatField = 'seats_premium_economy';
                break;
            case 'BUSINESS':
                seatField = 'seats_business';
                break;
            case 'FIRST':
                seatField = 'seats_first';
                break;
            case 'ECONOMY':
            default:
                seatField = 'seats_economy';
                break;
        }
        
        // Make sure to get the correct seat value from the departureFlight
        seatValue = departureFlight[seatField];
        
        console.log(`Checking seats for class ${seatClass}, field: ${seatField}, available: ${seatValue}, needed: ${totalPassengers}`);

        // Check if the selected class has enough seats
        if (seatValue < totalPassengers) {
            return res.status(400).json({ 
                error: `Not enough ${seatClass.toLowerCase()} seats available on departure flight`, 
                available: seatValue,
                requested: totalPassengers,
                seatClass: seatClass
            });
        }

        // Check if enough seats are available for return flight if this is a round trip
        if (finalIsRoundTrip && returnFlight) {
            let returnSeatValue;
            switch(seatClass) {
                case 'PREMIUM_ECONOMY':
                    returnSeatValue = returnFlight.seats_premium_economy;
                    break;
                case 'BUSINESS':
                    returnSeatValue = returnFlight.seats_business;
                    break;
                case 'FIRST':
                    returnSeatValue = returnFlight.seats_first;
                    break;
                case 'ECONOMY':
                default:
                    returnSeatValue = returnFlight.seats_economy;
                    break;
            }
            
            if (returnSeatValue < totalPassengers) {
                return res.status(400).json({ 
                    error: `Not enough ${seatClass.toLowerCase()} seats available on return flight`, 
                    available: returnSeatValue,
                    requested: totalPassengers,
                    seatClass: seatClass
                });
            }
        }

        // Calculate total amount based on provided total or calculate it
        let finalAmount;
        
        if (totalAmount !== undefined && totalAmount !== null) {
            // Use the provided total amount directly
            finalAmount = totalAmount;
            console.log("Tạo hóa đơn thành công với số tiền:", finalAmount);
        } else {
            // Calculate if not provided - this is a fallback
            console.log("No total amount provided, calculating based on seat prices");
            
            const seatClass = customerInfo.seatClass || 'ECONOMY';
            
            // Get the price for the selected seat class directly from the flight data
            let basePrice;
            
            // Select the appropriate price based on seat class
            switch(seatClass) {
                case 'PREMIUM_ECONOMY':
                    basePrice = departureFlight.price_premium_economy || departureFlight.price_economy;
                    break;
                case 'BUSINESS':
                    basePrice = departureFlight.price_business || departureFlight.price_economy;
                    break;
                case 'FIRST':
                    basePrice = departureFlight.price_first || departureFlight.price_economy;
                    break;
                case 'ECONOMY':
                default:
                    basePrice = departureFlight.price_economy;
                    break;
            }
            
            // Tính tổng giá dựa trên loại hành khách
            let calculatedAmount = 0;
            for (const passenger of passengers) {
                // Xác định loại hành khách dựa trên dữ liệu từ client hoặc tự suy luận từ ngày sinh
                const passengerType = passenger.passengerType || 
                                   passenger.type || 
                                   determinePassengerTypeFromDOB(passenger.dob) || 
                                   'ADULT';
                
                const passengerTypeMultiplier = getPriceMultiplierForPassengerType(passengerType.toUpperCase());
                
                // Tính giá vé cho hành khách này
                const passengerPrice = basePrice * passengerTypeMultiplier;
                calculatedAmount += passengerPrice;
                
                // Gán loại hành khách vào object hành khách
                passenger.calculatedPassengerType = passengerType.toUpperCase();
            }
            
            // If this is a round trip booking, add the return flight price
            if (finalIsRoundTrip && returnFlight) {
                // Get the price for the selected seat class from the return flight
                let returnBasePrice;
                
                // Select the appropriate price based on seat class
                switch(seatClass) {
                    case 'PREMIUM_ECONOMY':
                        returnBasePrice = returnFlight.price_premium_economy || returnFlight.price_economy;
                        break;
                    case 'BUSINESS':
                        returnBasePrice = returnFlight.price_business || returnFlight.price_economy;
                        break;
                    case 'FIRST':
                        returnBasePrice = returnFlight.price_first || returnFlight.price_economy;
                        break;
                    case 'ECONOMY':
                    default:
                        returnBasePrice = returnFlight.price_economy;
                        break;
                }
                
                // Calculate return flight cost for all passengers
                for (const passenger of passengers) {
                    const passengerType = passenger.calculatedPassengerType || 'ADULT';
                    const passengerTypeMultiplier = getPriceMultiplierForPassengerType(passengerType);
                    const passengerReturnPrice = returnBasePrice * passengerTypeMultiplier;
                    calculatedAmount += passengerReturnPrice;
                }
            }
        
        // Apply promo code if provided
            finalAmount = calculatedAmount;
        
        if (promoCode) {
            const promo = await db.get('SELECT * FROM promotions WHERE code = ? AND used_count < usage_limit AND valid_from <= date("now") AND valid_to >= date("now")', [promoCode]);
            
            if (promo) {
                    let discountApplied = 0;
                if (promo.discount_type === 'percent') {
                        discountApplied = calculatedAmount * (promo.discount_value / 100);
                } else if (promo.discount_type === 'fixed') {
                    discountApplied = promo.discount_value;
                }
                    finalAmount = calculatedAmount - discountApplied;
                
                // Update promo used count
                await db.run('UPDATE promotions SET used_count = used_count + 1 WHERE promo_id = ?', [promo.promo_id]);
                    console.log(`Promo code ${promoCode} used. Count incremented to ${promo.used_count + 1}.`);
                } else {
                    console.log(`Invalid or expired promo code: ${promoCode}`);
                }
            }
            
            console.log("Calculated total amount:", finalAmount);
        }
        
        // Ensure finalAmount is never negative
        finalAmount = Math.max(0, finalAmount);
        
        // Serialize passenger counts for storage
        const passengerCountsJSON = JSON.stringify(passengerCounts || {
            numAdults: passengers.filter(p => (p.type === 'adult' || p.passengerType === 'ADULT')).length,
            numChildren: passengers.filter(p => (p.type === 'child' || p.passengerType === 'CHILD')).length,
            numInfants: passengers.filter(p => (p.type === 'infant' || p.passengerType === 'INFANT')).length
        });
        
        // Generate a unique booking ID
        let bookingId;
        let isUnique = false;
        
        while (!isUnique) {
            bookingId = generateBookingId();
            // Check if this ID already exists
            const existingBooking = await db.get('SELECT booking_id FROM bookings WHERE booking_id = ?', [bookingId]);
            if (!existingBooking) {
                isUnique = true;
            }
        }
        
        // Update available seats in the flights table for departure flight
        console.log(`Updating seats for departure flight ${departureFlight.flight_id}, reducing ${seatField} by ${totalPassengers}`);
        await db.run(`UPDATE flights SET 
            ${seatField} = ${seatField} - ?, 
            available_seats = available_seats - ? 
            WHERE flight_id = ?`, 
            [totalPassengers, totalPassengers, departureFlight.flight_id]
        );
        
        // Log the updated flight info for verification
        const updatedDepartureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [departureFlight.flight_id]);
        console.log('Updated departure flight seats:', {
            flight_id: updatedDepartureFlight.flight_id,
            [seatField]: updatedDepartureFlight[seatField],
            available_seats: updatedDepartureFlight.available_seats
        });
        
        // Update available seats for return flight if this is a round trip booking
        if (finalIsRoundTrip && returnFlight) {
            let returnSeatField;
            switch(seatClass) {
                case 'PREMIUM_ECONOMY':
                    returnSeatField = 'seats_premium_economy';
                    break;
                case 'BUSINESS':
                    returnSeatField = 'seats_business';
                    break;
                case 'FIRST':
                    returnSeatField = 'seats_first';
                    break;
                case 'ECONOMY':
                default:
                    returnSeatField = 'seats_economy';
                    break;
            }
            
            console.log(`Updating seats for return flight ${returnFlight.flight_id}, reducing ${returnSeatField} by ${totalPassengers}`);
            await db.run(`UPDATE flights SET 
                ${returnSeatField} = ${returnSeatField} - ?, 
                available_seats = available_seats + ? 
                WHERE flight_id = ?`, 
                [totalPassengers, totalPassengers, returnFlight.flight_id]
            );
            
            // Log the updated return flight info for verification
            const updatedReturnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [returnFlight.flight_id]);
            console.log('Updated return flight seats:', {
                flight_id: updatedReturnFlight.flight_id,
                [returnSeatField]: updatedReturnFlight[returnSeatField],
                available_seats: updatedReturnFlight.available_seats
            });
        }
        
        // Insert booking record with passenger counts
        await db.run(`
            INSERT INTO bookings (
                booking_id, user_id, departure_flight_id, return_flight_id, contact_name, email, phone, travel_class, 
                total_amount, booking_time, payment_status, promo_code, passengers_info, is_round_trip, should_refund, cancelled_by_admin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            bookingId,
            userId, // Include userId here
            departureFlight.flight_id,
            finalIsRoundTrip ? returnFlight.flight_id : null,
            customerInfo.fullName,
            customerInfo.email,
            customerInfo.phone,
            customerInfo.seatClass || 'ECONOMY',
            finalAmount,
            new Date().toISOString(), // Explicitly set the current time with timezone info
            'unpaid',
            promoCode || null,
            passengerCountsJSON,
            finalIsRoundTrip ? 1 : 0,
            0,  // should_refund initialized to 0
            0   // cancelled_by_admin initialized to 0
        ]);
        
        // Check and sanitize passenger data
        for (const passenger of passengers) {
            // Check if required passenger properties exist
            if (!passenger.fullName) {
                return res.status(400).json({
                    error: 'Passenger data missing required fields',
                    details: 'fullName is required for all passengers'
                });
            }
            
            // Make sure we have a valid passport number or ID
            const passportNumber = passenger.idNumber || passenger.passport_number || passenger.passportNumber || 'UNKNOWN_ID';
            
            // Xác định loại hành khách - ưu tiên dữ liệu từ client hơn
            let passengerType;
            
            if (passenger.type) {
                // Nếu có dữ liệu type từ client, sử dụng và chuyển thành định dạng chuẩn
                if (passenger.type.toLowerCase() === 'adult') passengerType = 'ADULT';
                else if (passenger.type.toLowerCase() === 'child') passengerType = 'CHILD';
                else if (passenger.type.toLowerCase() === 'infant') passengerType = 'INFANT';
                else passengerType = 'ADULT'; // Mặc định là người lớn
            } else if (passenger.passengerType) {
                // Nếu có dữ liệu passengerType từ client
                passengerType = passenger.passengerType.toUpperCase();
            } else if (passenger.calculatedPassengerType) {
                // Nếu đã tính toán trước đó trong API
                passengerType = passenger.calculatedPassengerType;
            } else {
                // Nếu không có, xác định từ ngày sinh
                passengerType = determinePassengerTypeFromDOB(passenger.dob) || 'ADULT';
            }
            
            try {
            await db.run(`
                INSERT INTO booking_details (
                    booking_id, full_name, gender, dob, passport_number,
                        passenger_type, luggage_weight, insurance, meal
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                bookingId,
                passenger.fullName,
                    passenger.gender || 'UNKNOWN',
                    passenger.dob || null,
                    passportNumber,
                    passengerType,
                selectedServices && selectedServices.luggage ? 23 : 0,  // 23kg if luggage selected
                    selectedServices && selectedServices.insurance ? 1 : 0,  // 1 if insurance selected
                    selectedServices && (selectedServices.meal || selectedServices.food) ? 1 : 0  // 1 if meal selected
            ]);
            } catch (insertError) {
                console.error('Error inserting passenger booking details:', insertError);
                // Attempt to rollback by deleting the booking
                await db.run('DELETE FROM bookings WHERE booking_id = ?', [bookingId]);
                throw new Error(`Failed to save passenger details: ${insertError.message}`);
            }
        }
        
        // Insert payment information if provided
        if (paymentMethod) {
            // Validate payment method
            if (paymentMethod !== 'bank_transfer' && paymentMethod !== 'momo') {
                console.warn(`Invalid payment method: ${paymentMethod}. Defaulting to momo.`);
                paymentMethod = 'momo';
            }
            
            await db.run(`
                INSERT INTO payments (
                    booking_id, method, transaction_info
                ) VALUES (?, ?, ?)
            `, [
                bookingId,
                paymentMethod,
                transactionInfo || null
            ]);
        }
        
        res.status(201).json({ 
            success: true, 
            bookingId,
            redirectUrl: `payment-waiting.html?booking_id=${bookingId}`,
            message: 'Booking created successfully',
            flightDetails: formatFlightForClient(departureFlight),
            totalAmount: finalAmount
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        console.error('Error stack:', error.stack);
        console.error('Request data:', req.body);
        
        // Check if it's an SQLite constraint error
        if (error.code && error.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(500).json({ 
                error: 'Failed to create booking due to database constraint', 
                details: error.message,
                constraint: error.code 
            });
        }
        
        res.status(500).json({ error: 'Failed to create booking', details: error.message });
    }
});

app.get('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        // Get booking details
        const booking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Get departure flight details
        const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
        
        if (!departureFlight) {
            return res.status(404).json({ error: 'Departure flight not found for this booking' });
        }
        
        // Get return flight details if this is a round trip
        let returnFlight = null;
        if (booking.is_round_trip === 1 && booking.return_flight_id) {
            returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.return_flight_id]);
        }
        
        // Get passengers
        const passengers = await db.all('SELECT * FROM booking_details WHERE booking_id = ?', [bookingId]);
        
        // Get payment information
        const paymentInfo = await db.get('SELECT * FROM payments WHERE booking_id = ?', [bookingId]);
        
        // Format the response
        const response = {
            booking,
            departureFlight: formatFlightForClient(departureFlight),
            returnFlight: returnFlight ? formatFlightForClient(returnFlight) : null,
            passengers,
            paymentInfo
        };
        
        // Include the should_refund flag in the response if status is cancelled
        if (booking.payment_status === 'cancelled') {
            response.shouldRefund = booking.should_refund === 1;
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Failed to fetch booking details' });
    }
});

// Update booking payment status
app.patch('/api/bookings/:id/payment', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentStatus } = req.body;
        
        if (!paymentStatus) {
            return res.status(400).json({ error: 'Payment status is required' });
        }
        
        // Get current booking information to check previous status
        const currentBooking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!currentBooking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Determine if a refund is applicable (only when changing from paid to cancelled)
        let shouldRefund = false;
        if (paymentStatus === 'cancelled' && currentBooking.payment_status === 'paid') {
            shouldRefund = true;
        }
        
        // Handle promotion code usage when the booking status changes to paid
        if (paymentStatus === 'paid' && currentBooking.payment_status !== 'paid' && currentBooking.promo_code) {
            // Get promotion details
            const promo = await db.get('SELECT * FROM promotions WHERE code = ?', [currentBooking.promo_code]);
            
            if (promo) {
                // Update promo used count to ensure it's counted
                await db.run('UPDATE promotions SET used_count = used_count + 1 WHERE promo_id = ?', [promo.promo_id]);
                console.log(`Promo code ${currentBooking.promo_code} usage confirmed with payment. Count incremented.`);
            }
        }
        
        // Check if we're cancelling or refunding a previously paid booking
        if ((paymentStatus === 'cancelled' || paymentStatus === 'refunded') && 
            (currentBooking.payment_status === 'paid' || currentBooking.payment_status === 'unpaid')) {
            
            // Get the number of passengers in this booking
            const passengerCount = await db.get('SELECT COUNT(*) as count FROM booking_details WHERE booking_id = ?', [bookingId]);
            
            // Get the seat class used in the booking
            const seatClass = currentBooking.travel_class || 'ECONOMY';
            
            // Determine which seat field to update based on the seat class
            let seatField;
            switch(seatClass) {
                case 'PREMIUM_ECONOMY':
                    seatField = 'seats_premium_economy';
                    break;
                case 'BUSINESS':
                    seatField = 'seats_business';
                    break;
                case 'FIRST':
                    seatField = 'seats_first';
                    break;
                case 'ECONOMY':
                default:
                    seatField = 'seats_economy';
                    break;
            }
            
            // Restore the seats to the flights - both class-specific and total
            await db.run(`
                UPDATE flights SET 
                ${seatField} = ${seatField} + ?,
                available_seats = available_seats + ? 
                WHERE flight_id = ?
            `, [passengerCount.count, passengerCount.count, currentBooking.departure_flight_id]);
            
            // If this was a round trip, restore seats for the return flight too
            if (currentBooking.is_round_trip === 1 && currentBooking.return_flight_id) {
                await db.run(`
                    UPDATE flights SET 
                    ${seatField} = ${seatField} + ?,
                    available_seats = available_seats + ? 
                    WHERE flight_id = ?
                `, [passengerCount.count, passengerCount.count, currentBooking.return_flight_id]);
            }
        }
        
        // Update booking payment status with refund flag
        const result = await db.run(
            'UPDATE bookings SET payment_status = ?, should_refund = ?, cancelled_by_admin = ? WHERE booking_id = ?',
            [paymentStatus, shouldRefund ? 1 : 0, 0, bookingId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Payment status updated successfully',
            shouldRefund: shouldRefund
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Promotions API endpoints
app.get('/api/promotions', async (req, res) => {
    try {
        // Get query parameters
        const { code, status, type } = req.query;
        
        // Change this to get ALL promotions, not just valid ones
        let query = 'SELECT * FROM promotions';
        const params = [];
        
        // Apply filters if provided
        if (code) {
            query += ' WHERE code LIKE ?';
            params.push(`%${code}%`);
        } else {
            query += ' WHERE 1=1'; // Always true condition for consistent query structure
        }
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        if (type) {
            // Map UI type to database discount_type
            let discount_type;
            if (type === 'percentage') {
                discount_type = 'percent';
            } else {
                discount_type = type;
            }
            query += ' AND discount_type = ?';
            params.push(discount_type);
        }
        
        // Get all promotions without filtering by expiration date
        const promotions = await db.all(query, params);
        
        // Process promotions to update status based on dates
        const currentDate = new Date();
        const processedPromotions = promotions.map(promo => {
            const validTo = new Date(promo.valid_to);
            const validFrom = new Date(promo.valid_from);
            
            // Create a copy to avoid modifying the database object directly
            const updatedPromo = {...promo};
            
            // Update status based on dates
            if (validTo < currentDate) {
                // If end date has passed, mark as expired
                updatedPromo.status = 'expired';
            } else if (validFrom > currentDate) {
                // If start date is in future, mark as scheduled
                updatedPromo.status = 'scheduled';
            }
            
            return updatedPromo;
        });
        
        res.json(processedPromotions);
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).json({ error: 'Failed to fetch promotions' });
    }
});

// Add endpoint to delete a promotion
app.post('/api/promotions/delete', async (req, res) => {
    try {
        const { promo_id } = req.body;
        
        if (!promo_id) {
            return res.status(400).json({ error: 'Promotion ID is required' });
        }
        
        // Check if promotion exists
        const promotion = await db.get('SELECT * FROM promotions WHERE promo_id = ?', [promo_id]);
        
        if (!promotion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        
        // Delete the promotion
        await db.run('DELETE FROM promotions WHERE promo_id = ?', [promo_id]);
        
        res.json({ success: true, message: 'Promotion deleted successfully' });
    } catch (error) {
        console.error('Error deleting promotion:', error);
        res.status(500).json({ error: 'Failed to delete promotion' });
    }
});

// Add endpoint to create a new promotion
app.post('/api/promotions/create', async (req, res) => {
    try {
        const {
            code, name, description, type, discount_type, discount_value,
            valid_from, valid_to, usage_limit, status
        } = req.body;
        
        // Basic validation
        if (!code || !name || (!type && !discount_type) || discount_value === undefined) {
            return res.status(400).json({ error: 'Missing required promotion information' });
        }
        
        // Check if promotion code already exists
        const existingPromo = await db.get('SELECT * FROM promotions WHERE code = ?', [code]);
        if (existingPromo) {
            return res.status(400).json({ error: 'Promotion code already exists' });
        }
        
        // Map type field to discount_type if needed
        const finalDiscountType = discount_type || (type === 'percentage' ? 'percent' : type);
        
        // Default status to 'active' if not provided
        const promoStatus = status || 'active';
        
        // Insert new promotion
        const result = await db.run(`
            INSERT INTO promotions (
                code, name, description, discount_type, discount_value,
                valid_from, valid_to, usage_limit, used_count, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `, [
            code, name, description, finalDiscountType, discount_value,
            valid_from, valid_to, usage_limit, promoStatus
        ]);
        
        // Get the newly created promotion
        const newPromotion = await db.get('SELECT * FROM promotions WHERE promo_id = ?', result.lastID);
        
        res.status(201).json(newPromotion);
    } catch (error) {
        console.error('Error creating promotion:', error);
        res.status(500).json({ error: 'Failed to create promotion' });
    }
});

// Add endpoint to update an existing promotion
app.post('/api/promotions/update', async (req, res) => {
    try {
        const {
            promo_id, code, name, description, type, discount_type, discount_value,
            valid_from, valid_to, usage_limit, status
        } = req.body;
        
        if (!promo_id || !code || !name || (!type && !discount_type) || discount_value === undefined) {
            return res.status(400).json({ error: 'Missing required promotion information' });
        }
        
        // Check if promotion exists
        const existingPromo = await db.get('SELECT * FROM promotions WHERE promo_id = ?', [promo_id]);
        if (!existingPromo) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        
        // Check if updated code conflicts with another promotion
        const codeConflict = await db.get('SELECT * FROM promotions WHERE code = ? AND promo_id != ?', [code, promo_id]);
        if (codeConflict) {
            return res.status(400).json({ error: 'Promotion code already exists' });
        }
        
        // Map type field to discount_type if needed
        const finalDiscountType = discount_type || (type === 'percentage' ? 'percent' : type);
        
        // Default to existing status if not provided
        const promoStatus = status || existingPromo.status || 'active';
        
        // Update the promotion
        await db.run(`
            UPDATE promotions SET
                code = ?, name = ?, description = ?, discount_type = ?, discount_value = ?,
                valid_from = ?, valid_to = ?, usage_limit = ?, status = ?
            WHERE promo_id = ?
        `, [
            code, name, description, finalDiscountType, discount_value,
            valid_from, valid_to, usage_limit, promoStatus, promo_id
        ]);
        
        // Get the updated promotion
        const updatedPromotion = await db.get('SELECT * FROM promotions WHERE promo_id = ?', promo_id);
        
        res.json(updatedPromotion);
    } catch (error) {
        console.error('Error updating promotion:', error);
        res.status(500).json({ error: 'Failed to update promotion' });
    }
});

// Endpoint to validate promotion code
app.post('/api/promotions/validate', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Promotion code is required' });
        }
        
        // Get the promotion regardless of dates
        const promo = await db.get(
            'SELECT * FROM promotions WHERE code = ? AND status != "inactive" AND used_count < usage_limit',
            [code]
        );
        
        if (!promo) {
            return res.status(404).json({ error: 'Invalid or inactive promotion code' });
        }
        
        // Check dates manually
        const currentDate = new Date();
        const validFrom = new Date(promo.valid_from);
        const validTo = new Date(promo.valid_to);
        
        if (currentDate < validFrom) {
            return res.status(404).json({ error: 'Promotion code is not valid yet' });
        }
        
        if (currentDate > validTo) {
            return res.status(404).json({ error: 'Promotion code has expired' });
        }
        
        res.json({
            valid: true,
            promo: {
                code: promo.code,
                name: promo.name,
                description: promo.description,
                discountType: promo.discount_type,
                discountValue: promo.discount_value,
                status: promo.status
            }
        });
    } catch (error) {
        console.error('Error validating promotion:', error);
        res.status(500).json({ error: 'Failed to validate promotion code' });
    }
});

// Admin API: Get all bookings
app.get('/api/admin/bookings', async (req, res) => {
    try {
        const { bookingId, contactName, paymentStatus, fromDate, toDate } = req.query;
        
        let query = `
            SELECT b.*, 
                  (SELECT COUNT(*) FROM booking_details WHERE booking_id = b.booking_id) as passenger_count
            FROM bookings b
            WHERE 1=1
        `;
        const params = [];

        if (bookingId) {
            query += ' AND b.booking_id = ?';
            params.push(bookingId);
        }

        if (contactName) {
            query += ' AND b.contact_name LIKE ?';
            params.push(`%${contactName}%`);
        }

        if (paymentStatus) {
            query += ' AND b.payment_status = ?';
            params.push(paymentStatus);
        }

        if (fromDate) {
            query += ' AND DATE(b.booking_time) >= DATE(?)';
            params.push(fromDate);
        }

        if (toDate) {
            query += ' AND DATE(b.booking_time) <= DATE(?)';
            params.push(toDate);
        }

        query += ' ORDER BY b.booking_time DESC';
        
        const bookings = await db.all(query, params);
        
        // Add flight information to each booking
        for (const booking of bookings) {
            // Get departure flight information
            const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', booking.departure_flight_id);
            if (departureFlight) {
                booking.flight_info = {
                    airline: departureFlight.airline,
                    airline_code: departureFlight.airline_code,
                    flight_number: departureFlight.flight_number,
                    departure_airport: departureFlight.departure_airport,
                    arrival_airport: departureFlight.arrival_airport
                };
            }
            
            // Add return flight info only if this is a round-trip booking and has a return flight
            if (booking.is_round_trip === 1 && booking.return_flight_id) {
                const returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', booking.return_flight_id);
                if (returnFlight) {
                    booking.return_flight_info = {
                        airline: returnFlight.airline,
                        airline_code: returnFlight.airline_code,
                        flight_number: returnFlight.flight_number,
                        departure_airport: returnFlight.departure_airport,
                        arrival_airport: returnFlight.arrival_airport
                };
                }
            }
        }
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Admin API: Get booking details
app.get('/api/admin/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        // Get booking information
        const booking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Parse passenger counts if available
        let passengerCounts = null;
        if (booking.passengers_info) {
            try {
                passengerCounts = JSON.parse(booking.passengers_info);
            } catch (e) {
                console.error('Error parsing passenger counts:', e);
            }
        }
        
        // Get departure flight details
        const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
        
        // Get return flight details if this is a round-trip booking
        let returnFlight = null;
        if (booking.is_round_trip === 1 && booking.return_flight_id) {
            returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.return_flight_id]);
        }
        
        // Get passengers
        const passengers = await db.all('SELECT * FROM booking_details WHERE booking_id = ?', [bookingId]);
        
        // Get payment information
        let paymentInfo = null;
        try {
            paymentInfo = await db.get('SELECT * FROM payments WHERE booking_id = ?', [bookingId]);
        } catch (e) {
            console.error('Error fetching payment information:', e);
        }
        
        res.json({
            booking,
            passengerCounts,
            departureFlight: departureFlight ? formatFlightForClient(departureFlight) : null,
            returnFlight: returnFlight ? formatFlightForClient(returnFlight) : null,
            passengers,
            paymentInfo
        });
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).json({ error: 'Failed to fetch booking details' });
    }
});

// Admin API: Update booking payment status
app.patch('/api/admin/bookings/:id/payment', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentStatus } = req.body;
        
        if (!paymentStatus) {
            return res.status(400).json({ error: 'Payment status is required' });
        }
        
        // Validate payment status
        const validStatuses = ['unpaid', 'paid', 'refunded', 'cancelled'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }
        
        // Get current booking information to check previous status
        const currentBooking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!currentBooking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Determine if a refund is applicable (only when changing from paid to cancelled)
        let shouldRefund = false;
        if (paymentStatus === 'cancelled' && currentBooking.payment_status === 'paid') {
            shouldRefund = true;
        }
        
        // Set cancelled_by_admin flag when admin cancels a booking
        const cancelledByAdmin = paymentStatus === 'cancelled' ? 1 : 0;
        
        // Handle promotion code usage when the booking status changes to paid
        if (paymentStatus === 'paid' && currentBooking.payment_status !== 'paid' && currentBooking.promo_code) {
            // Get promotion details
            const promo = await db.get('SELECT * FROM promotions WHERE code = ?', [currentBooking.promo_code]);
            
            if (promo) {
                // Update promo used count to ensure it's counted
                await db.run('UPDATE promotions SET used_count = used_count + 1 WHERE promo_id = ?', [promo.promo_id]);
                console.log(`Promo code ${currentBooking.promo_code} usage confirmed with payment. Count incremented.`);
            }
        }
        
        // Check if we're cancelling or refunding a previously paid booking
        if ((paymentStatus === 'cancelled' || paymentStatus === 'refunded') && 
            (currentBooking.payment_status === 'paid' || currentBooking.payment_status === 'unpaid')) {
            
            // Get the number of passengers in this booking
            const passengerCount = await db.get('SELECT COUNT(*) as count FROM booking_details WHERE booking_id = ?', [bookingId]);
            
            // Get the seat class used in the booking
            const seatClass = currentBooking.travel_class || 'ECONOMY';
            
            // Determine which seat field to update based on the seat class
            let seatField;
            switch(seatClass) {
                case 'PREMIUM_ECONOMY':
                    seatField = 'seats_premium_economy';
                    break;
                case 'BUSINESS':
                    seatField = 'seats_business';
                    break;
                case 'FIRST':
                    seatField = 'seats_first';
                    break;
                case 'ECONOMY':
                default:
                    seatField = 'seats_economy';
                    break;
            }
            
            // Restore the seats to the flights - both class-specific and total
            await db.run(`
                UPDATE flights SET 
                ${seatField} = ${seatField} + ?,
                available_seats = available_seats + ? 
                WHERE flight_id = ?
            `, [passengerCount.count, passengerCount.count, currentBooking.departure_flight_id]);
            
            // If this was a round trip, restore seats for the return flight too
            if (currentBooking.is_round_trip === 1 && currentBooking.return_flight_id) {
                await db.run(`
                    UPDATE flights SET 
                    ${seatField} = ${seatField} + ?,
                    available_seats = available_seats + ? 
                    WHERE flight_id = ?
                `, [passengerCount.count, passengerCount.count, currentBooking.return_flight_id]);
            }
        }
        
        // Update booking payment status with refund flag and cancelled_by_admin flag
        const result = await db.run(
            'UPDATE bookings SET payment_status = ?, should_refund = ?, cancelled_by_admin = ? WHERE booking_id = ?',
            [paymentStatus, shouldRefund ? 1 : 0, cancelledByAdmin, bookingId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Payment status updated successfully', 
            paymentStatus,
            shouldRefund: shouldRefund,
            cancelledByAdmin: cancelledByAdmin === 1
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Admin API: Process a refund for a booking
app.post('/api/admin/bookings/:id/refund', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { refundAmount } = req.body;

        if (!refundAmount || isNaN(refundAmount) || refundAmount <= 0) {
            return res.status(400).json({ error: 'Invalid refund amount' });
        }

        // Get current booking information
        const currentBooking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);

        if (!currentBooking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if the booking is in a state that can be refunded
        if (currentBooking.payment_status !== 'cancelled') {
            return res.status(400).json({ error: 'Booking must be cancelled to be refunded' });
        }
        
        if (currentBooking.payment_status === 'refunded') {
            return res.status(400).json({ error: 'This booking has already been refunded' });
        }

        // Update booking status to 'refunded'
        const result = await db.run(
            "UPDATE bookings SET payment_status = 'refunded' WHERE booking_id = ?",
            [bookingId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Booking not found or status could not be updated' });
        }

        // Optionally, log the refund transaction somewhere
        // For now, just updating the status is enough

        res.json({
            success: true,
            message: 'Refund processed successfully',
            bookingId: bookingId,
            refundedAmount: refundAmount
        });

    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Failed to process refund' });
    }
});

// Helper function for assign seats removed

// Admin API: Get booking statistics
app.get('/api/admin/stats/bookings', async (req, res) => {
    try {
        // Get booking count by payment status
        const statusStats = await db.all(`
            SELECT payment_status, COUNT(*) as count 
            FROM bookings 
            GROUP BY payment_status 
            ORDER BY count DESC
        `);
        
        // Get total revenue
        const revenue = await db.get(`
            SELECT SUM(total_amount) as total 
            FROM bookings 
            WHERE payment_status = 'paid'
        `);
        
        // Get bookings by travel class
        const travelClassStats = await db.all(`
            SELECT travel_class, COUNT(*) as count 
            FROM bookings 
            GROUP BY travel_class
        `);
        
        // Get recent bookings (last 7 days)
        const recentBookings = await db.all(`
            SELECT DATE(booking_time) as date, COUNT(*) as count 
            FROM bookings 
            WHERE booking_time >= datetime('now', '-7 days')
            GROUP BY DATE(booking_time)
            ORDER BY date
        `);
        
        res.json({
            totalBookings: statusStats.reduce((acc, stat) => acc + stat.count, 0),
            totalRevenue: revenue.total || 0,
            statusStats,
            travelClassStats,
            recentBookings
        });
    } catch (error) {
        console.error('Error fetching booking statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Add new endpoint to save/update payment information
app.post('/api/payments', async (req, res) => {
    try {
        const { bookingId, method, transactionInfo } = req.body;
        
        if (!bookingId || !method) {
            return res.status(400).json({ error: 'Missing required payment information' });
        }
        
        // Validate payment method
        if (method !== 'bank_transfer' && method !== 'momo') {
            return res.status(400).json({ error: 'Invalid payment method' });
        }
        
        // Check if booking exists
        const existingBooking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        if (!existingBooking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Check if payment already exists
        const existingPayment = await db.get('SELECT * FROM payments WHERE booking_id = ?', [bookingId]);
        
        if (existingPayment) {
            // Update existing payment
            await db.run(`
                UPDATE payments 
                SET method = ?, transaction_info = ?, payment_date = CURRENT_TIMESTAMP
                WHERE booking_id = ?
            `, [method, transactionInfo || null, bookingId]);
        } else {
            // Insert new payment
            await db.run(`
                INSERT INTO payments (
                    booking_id, method, transaction_info
                ) VALUES (?, ?, ?)
            `, [bookingId, method, transactionInfo || null]);
        }
        
        // Also update booking payment status to 'pending'
        await db.run(`
            UPDATE bookings 
            SET payment_status = 'pending'
            WHERE booking_id = ?
        `, [bookingId]);
        
        res.json({ 
            success: true, 
            message: 'Payment information saved successfully'
        });
    } catch (error) {
        console.error('Error saving payment information:', error);
        res.status(500).json({ error: 'Failed to save payment information' });
    }
});

// Get payment information for a booking
app.get('/api/payments/:bookingId', async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        
        // Check if booking exists
        const existingBooking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        if (!existingBooking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Get payment information
        const payment = await db.get('SELECT * FROM payments WHERE booking_id = ?', [bookingId]);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment information not found' });
        }
        
        res.json(payment);
    } catch (error) {
        console.error('Error fetching payment information:', error);
        res.status(500).json({ error: 'Failed to fetch payment information' });
    }
});

// Helper functions
function formatDateForDB(dateString) {
    // Convert from YYYY-MM-DD to YYYY-MM-DD (for SQLite date format)
    const [year, month, day] = dateString.split('-');
    return `${year}-${month}-${day}`;
}

function formatFlightForClient(flight) {
    // Parse available classes từ string
    let availableClasses;
    try {
        // Thử chuyển đổi từ JSON string nếu đó là định dạng lưu trữ
        availableClasses = JSON.parse(flight.available_classes);
    } catch (error) {
        // Nếu không phải JSON, xử lý như một string phân cách bằng dấu phẩy
        availableClasses = flight.available_classes.split(',');
    }
    
    // Extract date from departure_time
    const departureDate = new Date(flight.departure_time);
    const day = String(departureDate.getDate()).padStart(2, '0');
    const month = String(departureDate.getMonth() + 1).padStart(2, '0');
    const year = departureDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;
    
    // Extract hours and minutes from departure_time and arrival_time
    const departureHours = String(departureDate.getHours()).padStart(2, '0');
    const departureMinutes = String(departureDate.getMinutes()).padStart(2, '0');
    const departureTime = `${departureHours}:${departureMinutes}`;
    
    const arrivalDate = new Date(flight.arrival_time);
    const arrivalHours = String(arrivalDate.getHours()).padStart(2, '0');
    const arrivalMinutes = String(arrivalDate.getMinutes()).padStart(2, '0');
    const arrivalTime = `${arrivalHours}:${arrivalMinutes}`;
    
    // For compatibility with old code, use economy price as the base price
    const basePrice = flight.price_economy || flight.price || 0;
    
    return {
        id: `${flight.airline_code}${flight.flight_number}`,
        flight_id: flight.flight_id,
        airline: flight.airline,
        airline_code: flight.airline_code,
        airlineCode: flight.airline_code,
        flight_number: flight.flight_number,
        departure: flight.departure_airport,
        departure_airport: flight.departure_airport,
        destination: flight.arrival_airport,
        arrival_airport: flight.arrival_airport,
        departureTime: departureTime,
        departure_time: flight.departure_time,
        arrivalTime: arrivalTime,
        arrival_time: flight.arrival_time,
        duration: flight.duration,
        // Include both the legacy price field and the new class-specific prices
        price: basePrice,
        price_economy: flight.price_economy || basePrice,
        price_premium_economy: flight.price_premium_economy || null,
        price_business: flight.price_business || null,
        price_first: flight.price_first || null,
        // Create a prices object for easy access
        prices: {
            ECONOMY: flight.price_economy || basePrice,
            PREMIUM_ECONOMY: flight.price_premium_economy || null,
            BUSINESS: flight.price_business || null,
            FIRST: flight.price_first || null
        },
        // Include seats for each class
        seats_economy: flight.seats_economy || 0,
        seats_premium_economy: flight.seats_premium_economy || 0,
        seats_business: flight.seats_business || 0, 
        seats_first: flight.seats_first || 0,
        // Create a seats object for easy access
        seats: {
            ECONOMY: flight.seats_economy || 0,
            PREMIUM_ECONOMY: flight.seats_premium_economy || 0,
            BUSINESS: flight.seats_business || 0,
            FIRST: flight.seats_first || 0
        },
        availableSeats: flight.available_seats,
        available_seats: flight.available_seats,
        status: flight.status,
        availableClasses: availableClasses,
        available_classes: flight.available_classes,
        flightClass: 'Economy', // Default display class
        date: formattedDate
    };
}

// Sample data population function
async function populateSampleFlights() {
    const airlines = [
        { 
            code: 'VN', 
            name: 'Vietnam Airlines', 
            classes: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
            seatsConfig: {
                ECONOMY: { min: 100, max: 150 },
                PREMIUM_ECONOMY: { min: 30, max: 50 },
                BUSINESS: { min: 20, max: 30 },
                FIRST: { min: 8, max: 12 }
            }
        },
        { 
            code: 'VJ', 
            name: 'Vietjet Air', 
            classes: ['ECONOMY', 'PREMIUM_ECONOMY'],
            seatsConfig: {
                ECONOMY: { min: 150, max: 180 },
                PREMIUM_ECONOMY: { min: 20, max: 30 }
            }
        },
        { 
            code: 'BL', 
            name: 'Jetstar Pacific', 
            classes: ['ECONOMY'],
            seatsConfig: {
                ECONOMY: { min: 150, max: 200 }
            }
        },
        { 
            code: 'QH', 
            name: 'Bamboo Airways', 
            classes: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS'],
            seatsConfig: {
                ECONOMY: { min: 120, max: 160 },
                PREMIUM_ECONOMY: { min: 20, max: 40 },
                BUSINESS: { min: 10, max: 20 }
            }
        }
    ];
    
    const routes = [
        { departure: 'HAN', destination: 'SGN' },
        { departure: 'SGN', destination: 'HAN' },
        { departure: 'HAN', destination: 'DAD' },
        { departure: 'DAD', destination: 'HAN' },
        { departure: 'SGN', destination: 'DAD' },
        { departure: 'DAD', destination: 'SGN' }
    ];

    const startDate = new Date(2025, 5, 1); // June 1, 2025 (month is 0-indexed)
    const endDate = new Date(2025, 6, 1);   // July 1, 2025
    
    const stmt = await db.prepare(`
        INSERT INTO flights (
            airline, airline_code, flight_number, departure_airport, arrival_airport, 
            departure_time, arrival_time, duration, 
            price_economy, price_premium_economy, price_business, price_first,
            seats_economy, seats_premium_economy, seats_business, seats_first,
            available_seats, status, available_classes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let flightCounter = 1000;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        for (let i = 0; i < 10; i++) {
            const airlineInfo = airlines[Math.floor(Math.random() * airlines.length)];
            const routeInfo = routes[Math.floor(Math.random() * routes.length)];
            
            const depHour = Math.floor(Math.random() * 18) + 6; // Departure between 06:00 and 23:00
            const depMinute = Math.floor(Math.random() * 4) * 15; // Minutes: 00, 15, 30, 45
            
            const departureDateTime = new Date(d);
            departureDateTime.setHours(depHour, depMinute, 0);
            
            const durationHours = Math.floor(Math.random() * 2) + 1; // Duration 1 to 2 hours
            const durationMinutes = Math.floor(Math.random() * 4) * 15; // Duration minutes
            
            const arrivalDateTime = new Date(departureDateTime);
            arrivalDateTime.setHours(
                departureDateTime.getHours() + durationHours,
                departureDateTime.getMinutes() + durationMinutes
            );
            
            const durationStr = `${durationHours}h ${durationMinutes > 0 ? `${durationMinutes}m` : ''}`.trim();
            
            // Base economy price from 500,000 to 2,000,000
            const economyPrice = Math.floor(Math.random() * 1500000) + 500000;
            
            // Calculate prices for other seat classes with some randomness
            // These are now independent prices rather than strict multipliers
            const premiumEconomyPrice = airlineInfo.classes.includes('PREMIUM_ECONOMY') ? 
                Math.floor(economyPrice * (1.3 + Math.random() * 0.4)) : null;
                
            const businessPrice = airlineInfo.classes.includes('BUSINESS') ? 
                Math.floor(economyPrice * (2.2 + Math.random() * 0.6)) : null;
                
            const firstPrice = airlineInfo.classes.includes('FIRST') ? 
                Math.floor(economyPrice * (3.5 + Math.random() * 1.0)) : null;
            
            // Generate seat quantities for each class
            const seatsEconomy = airlineInfo.classes.includes('ECONOMY') ? 
                Math.floor(Math.random() * (airlineInfo.seatsConfig.ECONOMY.max - airlineInfo.seatsConfig.ECONOMY.min + 1)) + airlineInfo.seatsConfig.ECONOMY.min : 0;
                
            const seatsPremiumEconomy = airlineInfo.classes.includes('PREMIUM_ECONOMY') ?
                Math.floor(Math.random() * (airlineInfo.seatsConfig.PREMIUM_ECONOMY.max - airlineInfo.seatsConfig.PREMIUM_ECONOMY.min + 1)) + airlineInfo.seatsConfig.PREMIUM_ECONOMY.min : 0;
                
            const seatsBusiness = airlineInfo.classes.includes('BUSINESS') ?
                Math.floor(Math.random() * (airlineInfo.seatsConfig.BUSINESS.max - airlineInfo.seatsConfig.BUSINESS.min + 1)) + airlineInfo.seatsConfig.BUSINESS.min : 0;
                
            const seatsFirst = airlineInfo.classes.includes('FIRST') ?
                Math.floor(Math.random() * (airlineInfo.seatsConfig.FIRST.max - airlineInfo.seatsConfig.FIRST.min + 1)) + airlineInfo.seatsConfig.FIRST.min : 0;
            
            // Calculate total available seats
            const totalSeats = seatsEconomy + seatsPremiumEconomy + seatsBusiness + seatsFirst;
            
            let flightAvailableClasses = [...airlineInfo.classes].sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * airlineInfo.classes.length) + 1);
            
            // Ensure 'ECONOMY' is usually present
            if (airlineInfo.classes.includes('ECONOMY') && !flightAvailableClasses.includes('ECONOMY')) {
                if (Math.random() < 0.8) { // 80% chance to add ECONOMY
                    flightAvailableClasses.push('ECONOMY');
                }
            }
            
            // Ensure there's at least one class, and remove duplicates
            flightAvailableClasses = [...new Set(flightAvailableClasses)];
            if (flightAvailableClasses.length === 0) {
                if (airlineInfo.classes.includes('ECONOMY')) {
                    flightAvailableClasses = ['ECONOMY'];
                } else if (airlineInfo.classes.length > 0) {
                    flightAvailableClasses = [airlineInfo.classes[0]];
                } else {
                    flightAvailableClasses = ['ECONOMY'];
                }
            }
            
            const flightNumber = String(flightCounter++);
            
            // Lưu available_classes dưới dạng chuỗi (không phải JSON)
            const availableClassesString = flightAvailableClasses.join(',');
            
            await stmt.run(
                airlineInfo.name,
                airlineInfo.code,
                flightNumber,
                routeInfo.departure,
                routeInfo.destination,
                departureDateTime.toISOString(),
                arrivalDateTime.toISOString(),
                durationStr,
                economyPrice,
                premiumEconomyPrice,
                businessPrice,
                firstPrice,
                seatsEconomy,
                seatsPremiumEconomy,
                seatsBusiness,
                seatsFirst,
                totalSeats,
                'scheduled',
                availableClassesString
            );
        }
    }
    
    await stmt.finalize();
    console.log('Sample flights added to the database.');
}

// Helper function to generate booking number
function generateBookingNumber() {
    const timestamp = new Date().getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `FV${timestamp}${random}`;
}

// Helper function to get price multiplier based on passenger type
function getPriceMultiplierForPassengerType(passengerType) {
    const multipliers = {
        'ADULT': 1,      // Người lớn: 100% giá vé
        'CHILD': 0.75,   // Trẻ em: 75% giá vé
        'INFANT': 0.1    // Em bé: 10% giá vé
    };
    return multipliers[passengerType] || 1;
}

// Helper function to determine passenger type based on date of birth
function determinePassengerTypeFromDOB(dobString) {
    if (!dobString) return 'ADULT'; // Mặc định là người lớn nếu không có ngày sinh
    
    try {
        const dob = new Date(dobString);
        const today = new Date();
        const ageInYears = (today - dob) / (365.25 * 24 * 60 * 60 * 1000);
        
        if (ageInYears < 2) {
            return 'INFANT'; // Em bé dưới 2 tuổi
        } else if (ageInYears < 12) {
            return 'CHILD';  // Trẻ em từ 2 đến dưới 12 tuổi
        } else {
            return 'ADULT';  // Người lớn từ 12 tuổi trở lên
        }
    } catch (error) {
        console.error('Error determining passenger type from DOB:', error);
        return 'ADULT'; // Mặc định là người lớn nếu có lỗi xảy ra
    }
}

// Sample promotions data
async function populateSamplePromotions() {
    const promotions = [
        {
            code: 'SUMMER25',
            name: 'Khuyến mãi mùa hè',
            description: 'Giảm 25% cho tất cả các chuyến bay trong mùa hè',
            discount_type: 'percent',
            discount_value: 25,
            valid_from: '2025-06-01',
            valid_to: '2025-08-31',
            usage_limit: 100,
            status: 'scheduled'
        },
        {
            code: 'WELCOME10',
            name: 'Ưu đãi chào mừng',
            description: 'Giảm 10% cho lần đặt vé đầu tiên',
            discount_type: 'percent',
            discount_value: 10,
            valid_from: '2025-01-01',
            valid_to: '2025-12-31',
            usage_limit: 500,
            status: 'active'
        },
        {
            code: 'FIXED200K',
            name: 'Giảm 200K',
            description: 'Giảm 200,000 VND cho mọi đơn hàng',
            discount_type: 'fixed',
            discount_value: 200000,
            valid_from: '2025-05-01',
            valid_to: '2025-07-31',
            usage_limit: 50,
            status: 'active'
        }
    ];
    
    for (const promo of promotions) {
        await db.run(`
            INSERT INTO promotions (
                code, name, description, discount_type, discount_value,
                valid_from, valid_to, usage_limit, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            promo.code,
            promo.name,
            promo.description,
            promo.discount_type,
            promo.discount_value,
            promo.valid_from,
            promo.valid_to,
            promo.usage_limit,
            promo.status
        ]);
    }
    
    console.log('Sample promotions added to the database.');
}

// Helper functions for seat generation removed

// Generate random booking ID with 10 characters (uppercase letters and numbers)
function generateBookingId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Initialize database and start server
setupDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            
            // Schedule the first status update
            setTimeout(updatePromotionStatuses, 1000);
            
            // Then run the status update every hour
            setInterval(updatePromotionStatuses, 60 * 60 * 1000);
        });
    })
    .catch(error => {
        console.error('Failed to setup database:', error);
        process.exit(1);
    }); 

// Function to update promotion statuses based on dates
async function updatePromotionStatuses() {
    try {
        console.log('Updating promotion statuses based on dates...');
        const currentDate = new Date().toISOString();
        
        // Update expired promotions
        await db.run(`
            UPDATE promotions 
            SET status = 'expired' 
            WHERE valid_to < ? AND status != 'expired' AND status != 'inactive'
        `, [currentDate]);
        
        // Update scheduled promotions that are now active
        await db.run(`
            UPDATE promotions 
            SET status = 'active' 
            WHERE valid_from <= ? AND valid_to >= ? AND status = 'scheduled'
        `, [currentDate, currentDate]);
        
        console.log('Promotion statuses updated successfully');
    } catch (error) {
        console.error('Error updating promotion statuses:', error);
    }
} 

// Admin API: Get statistics data
app.get('/api/admin/statistics', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required parameters' });
        }
        
        // Format dates to ensure they are in correct format
        const formattedFromDate = fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`;
        const formattedToDate = toDate.includes('T') ? toDate : `${toDate}T23:59:59.999Z`;
        
        // Get core statistics from our helper function
        const coreStats = await getStatisticsForPeriod(formattedFromDate, formattedToDate);
        
        // Get revenue by date
        const revenueByDateQuery = await db.all(`
            SELECT 
                DATE(booking_time) as date, 
                SUM(total_amount) as amount 
            FROM bookings 
            WHERE payment_status = 'paid' AND booking_time BETWEEN ? AND ?
            GROUP BY DATE(booking_time)
            ORDER BY date
        `, [formattedFromDate, formattedToDate]);
        
        // Ensure we have valid data
        const revenueByDate = revenueByDateQuery || [];
        
        // Get bookings by date
        const bookingsByDateQuery = await db.all(`
            SELECT 
                DATE(booking_time) as date, 
                COUNT(*) as count 
            FROM bookings 
            WHERE booking_time BETWEEN ? AND ?
            GROUP BY DATE(booking_time)
            ORDER BY date
        `, [formattedFromDate, formattedToDate]);
        
        // Ensure we have valid data
        const bookingsByDate = bookingsByDateQuery || [];
        
        // Get bookings by status
        const bookingsByStatusQuery = await db.all(`
            SELECT 
                payment_status as status, 
                COUNT(*) as count 
            FROM bookings 
            WHERE booking_time BETWEEN ? AND ?
            GROUP BY payment_status
        `, [formattedFromDate, formattedToDate]);
        
        // Ensure we have valid data
        const bookingsByStatus = bookingsByStatusQuery || [];
        
        // Get popular routes based on bookings
        const popularRoutesQuery = await db.all(`
            SELECT 
                f.departure_airport as departure, 
                f.arrival_airport as destination, 
                COUNT(b.booking_id) as count,
                SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END) as revenue,
                (
                    (
                        SELECT COUNT(*) 
                        FROM booking_details bd 
                        JOIN bookings b2 ON bd.booking_id = b2.booking_id 
                        WHERE b2.departure_flight_id = f.flight_id AND b2.payment_status = 'paid'
                    ) * 100.0 / NULLIF(f.seats_economy, 0)
                ) as occupancyRate
            FROM bookings b
            JOIN flights f ON b.departure_flight_id = f.flight_id
            WHERE b.booking_time BETWEEN ? AND ?
            GROUP BY f.departure_airport, f.arrival_airport
            ORDER BY count DESC
        `, [formattedFromDate, formattedToDate]);
        
        // Ensure we have valid data and handle missing values
        const popularRoutes = (popularRoutesQuery || []).map(route => ({
            departure: route.departure,
            destination: route.destination,
            count: route.count || 0,
            revenue: route.revenue || 0,
            occupancyRate: route.occupancyRate || 0
        }));
        
        // Format the response
        const response = {
            ...coreStats,
            revenueByDate,
            bookingsByDate,
            bookingsByStatus,
            popularRoutes
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        // Return a minimal valid response with default values
        res.status(200).json({
            totalBookings: 0,
            totalRevenue: 0,
            totalPassengers: 0,
            occupancyRate: 0,
            revenueByDate: [],
            bookingsByDate: [],
            bookingsByStatus: [],
            popularRoutes: []
        });
    }
});

// Admin API: Export statistics
app.get('/api/admin/statistics/export', async (req, res) => {
    try {
        const { format, fromDate, toDate } = req.query;
        
        if (!format || !fromDate || !toDate) {
            return res.status(400).json({ error: 'format, fromDate and toDate are required parameters' });
        }
        
        // Format dates to ensure they are in correct format
        const formattedFromDate = fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00.000Z`;
        const formattedToDate = toDate.includes('T') ? toDate : `${toDate}T23:59:59.999Z`;
        
        // Get statistics data for the report
        const coreStats = await getStatisticsForPeriod(formattedFromDate, formattedToDate);
        
        // Get revenue by date
        const revenueByDate = await db.all(`
            SELECT 
                DATE(booking_time) as date, 
                SUM(total_amount) as amount 
            FROM bookings 
            WHERE payment_status = 'paid' AND booking_time BETWEEN ? AND ?
            GROUP BY DATE(booking_time)
            ORDER BY date
        `, [formattedFromDate, formattedToDate]) || [];
        
        // Get bookings by date
        const bookingsByDate = await db.all(`
            SELECT 
                DATE(booking_time) as date, 
                COUNT(*) as count 
            FROM bookings 
            WHERE booking_time BETWEEN ? AND ?
            GROUP BY DATE(booking_time)
            ORDER BY date
        `, [formattedFromDate, formattedToDate]) || [];
        
        // Get bookings by status
        const bookingsByStatus = await db.all(`
            SELECT 
                payment_status as status, 
                COUNT(*) as count 
            FROM bookings 
            WHERE booking_time BETWEEN ? AND ?
            GROUP BY payment_status
        `, [formattedFromDate, formattedToDate]) || [];
        
        // Get popular routes based on bookings
        const popularRoutesQuery = await db.all(`
            SELECT 
                f.departure_airport as departure, 
                f.arrival_airport as destination, 
                COUNT(b.booking_id) as count,
                SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount ELSE 0 END) as revenue
            FROM bookings b
            JOIN flights f ON b.departure_flight_id = f.flight_id
            WHERE b.booking_time BETWEEN ? AND ?
            GROUP BY f.departure_airport, f.arrival_airport
            ORDER BY count DESC
        `, [formattedFromDate, formattedToDate]);
        
        // Format popular routes data
        const popularRoutes = (popularRoutesQuery || []).map(route => ({
            departure: route.departure,
            destination: route.destination,
            count: route.count || 0,
            revenue: route.revenue || 0
        }));
        
        // Format the response data
        const reportData = {
            reportTitle: `Báo cáo thống kê từ ${fromDate} đến ${toDate}`,
            generatedDate: new Date().toLocaleString('vi-VN'),
            period: {
                fromDate,
                toDate
            },
            coreStats: {
                totalBookings: coreStats.totalBookings,
                totalRevenue: coreStats.totalRevenue,
                totalPassengers: coreStats.totalPassengers
            },
            revenueByDate,
            bookingsByDate,
            bookingsByStatus,
            popularRoutes
        };
        
        // Return JSON data for now (both formats)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=statistics-${fromDate}-to-${toDate}.json`);
        res.json(reportData);
        
        /* 
        // In a production environment, we would generate actual PDF and Excel files
        if (format === 'pdf') {
            // Example with pdfkit (would need to npm install pdfkit)
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=statistics-${fromDate}-to-${toDate}.pdf`);
            
            doc.pipe(res);
            
            // Add content to PDF
            doc.fontSize(25).text(reportData.reportTitle, 100, 100);
            doc.fontSize(12).text(`Ngày tạo: ${reportData.generatedDate}`, 100, 150);
            
            // Core stats
            doc.fontSize(16).text('Thống kê tổng quan', 100, 200);
            doc.fontSize(12).text(`Tổng đơn đặt vé: ${reportData.coreStats.totalBookings}`, 120, 230);
            doc.fontSize(12).text(`Doanh thu: ${formatCurrency(reportData.coreStats.totalRevenue)}`, 120, 250);
            doc.fontSize(12).text(`Số hành khách: ${reportData.coreStats.totalPassengers}`, 120, 270);
            
            // Add tables for detailed data
            // ...
            
            doc.end();
        } else if (format === 'excel') {
            // Example with exceljs (would need to npm install exceljs)
            const Excel = require('exceljs');
            const workbook = new Excel.Workbook();
            const worksheet = workbook.addWorksheet('Thống kê');
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=statistics-${fromDate}-to-${toDate}.xlsx`);
            
            // Add headers
            worksheet.columns = [
                { header: 'Chỉ số', key: 'metric', width: 30 },
                { header: 'Giá trị', key: 'value', width: 20 }
            ];
            
            // Add core stats
            worksheet.addRow({ metric: 'Tổng đơn đặt vé', value: reportData.coreStats.totalBookings });
            worksheet.addRow({ metric: 'Doanh thu', value: reportData.coreStats.totalRevenue });
            worksheet.addRow({ metric: 'Số hành khách', value: reportData.coreStats.totalPassengers });
            
            // Add revenue by date
            worksheet.addRow({});
            worksheet.addRow({ metric: 'Doanh thu theo ngày' });
            worksheet.addRow({ metric: 'Ngày', value: 'Doanh thu' });
            
            reportData.revenueByDate.forEach(item => {
                worksheet.addRow({ metric: item.date, value: item.amount });
            });
            
            // Add more data
            // ...
            
            await workbook.xlsx.write(res);
        }
        */
    } catch (error) {
        console.error('Error exporting statistics:', error);
        res.status(500).json({ error: 'Failed to export statistics', details: error.message });
    }
});

// Admin API: Get comparison statistics
app.get('/api/admin/statistics/compare', async (req, res) => {
    try {
        const { currentFromDate, currentToDate, previousFromDate, previousToDate } = req.query;
        
        if (!currentFromDate || !currentToDate || !previousFromDate || !previousToDate) {
            return res.status(400).json({ 
                error: 'Missing required parameters',
                requiredParams: ['currentFromDate', 'currentToDate', 'previousFromDate', 'previousToDate']
            });
        }
        
        // Format dates
        const formatDate = (date) => date.includes('T') ? date : `${date}T00:00:00.000Z`;
        
        const formattedCurrentFromDate = formatDate(currentFromDate);
        const formattedCurrentToDate = formatDate(currentToDate);
        const formattedPreviousFromDate = formatDate(previousFromDate);
        const formattedPreviousToDate = formatDate(previousToDate);
        
        // Get current period metrics
        const currentStats = await getStatisticsForPeriod(formattedCurrentFromDate, formattedCurrentToDate);
        
        // Get previous period metrics
        const previousStats = await getStatisticsForPeriod(formattedPreviousFromDate, formattedPreviousToDate);
        
        // Calculate percentage changes
        const changes = {
            bookingsChange: calculatePercentageChange(currentStats.totalBookings, previousStats.totalBookings),
            revenueChange: calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue),
            passengersChange: calculatePercentageChange(currentStats.totalPassengers, previousStats.totalPassengers),
            occupancyChange: calculatePercentageChange(currentStats.occupancyRate, previousStats.occupancyRate)
        };
        
        res.json({
            current: currentStats,
            previous: previousStats,
            changes
        });
    } catch (error) {
        console.error('Error fetching comparison statistics:', error);
        res.status(500).json({ error: 'Failed to fetch comparison statistics', details: error.message });
    }
});

// Helper function to get statistics for a specific time period
async function getStatisticsForPeriod(fromDate, toDate) {
    try {
        // Get total bookings
        const totalBookingsQuery = await db.get(`
            SELECT COUNT(*) as count 
            FROM bookings 
            WHERE booking_time BETWEEN ? AND ?
        `, [fromDate, toDate]);
        
        const totalBookings = totalBookingsQuery ? (totalBookingsQuery.count || 0) : 0;
        
        // Get revenue from paid bookings
        const totalRevenueQuery = await db.get(`
            SELECT SUM(total_amount) as total 
            FROM bookings 
            WHERE payment_status = 'paid' AND booking_time BETWEEN ? AND ?
        `, [fromDate, toDate]);
        
        const totalRevenue = totalRevenueQuery && totalRevenueQuery.total !== null ? totalRevenueQuery.total : 0;
        
        // Get total passengers
        const totalPassengersQuery = await db.get(`
            SELECT COUNT(*) as count 
            FROM booking_details bd
            JOIN bookings b ON bd.booking_id = b.booking_id
            WHERE b.booking_time BETWEEN ? AND ?
        `, [fromDate, toDate]);
        
        const totalPassengers = totalPassengersQuery ? (totalPassengersQuery.count || 0) : 0;
        
        // Get occupancy data
        const occupancyRateQuery = await db.all(`
            SELECT 
                f.flight_id,
                f.seats_economy,
                (SELECT COUNT(*) FROM booking_details bd JOIN bookings b ON bd.booking_id = b.booking_id 
                 WHERE b.departure_flight_id = f.flight_id AND b.travel_class = 'ECONOMY' AND b.booking_time BETWEEN ? AND ?) as booked_seats
            FROM flights f
            WHERE f.departure_time BETWEEN ? AND ?
        `, [fromDate, toDate, fromDate, toDate]);
        
        // Calculate occupancy rate
        let totalOccupancy = 0;
        let flightCount = 0;
        
        if (occupancyRateQuery && occupancyRateQuery.length > 0) {
            occupancyRateQuery.forEach(flight => {
                if (flight.seats_economy > 0) {
                    const rate = (flight.booked_seats / flight.seats_economy) * 100;
                    totalOccupancy += rate;
                    flightCount++;
                }
            });
        }
        
        const occupancyRate = flightCount > 0 ? totalOccupancy / flightCount : 0;
        
        console.log('Statistics calculated for period:', { fromDate, toDate, totalBookings, totalRevenue, totalPassengers, occupancyRate });
        
        return {
            totalBookings,
            totalRevenue,
            totalPassengers,
            occupancyRate
        };
    } catch (error) {
        console.error('Error calculating statistics:', error);
        // Return default values if there's an error
        return {
            totalBookings: 0,
            totalRevenue: 0,
            totalPassengers: 0,
            occupancyRate: 0
        };
    }
}

// Helper function to calculate percentage change
function calculatePercentageChange(current, previous) {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

// API endpoints for user registration and authentication
app.post('/api/users/register', async (req, res) => {
    try {
        const { fullname, email, phone, password } = req.body;
        
        // Validate required fields
        if (!fullname || !email || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        
        // Check if email already exists
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email đã được sử dụng' });
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Insert new user
        const result = await db.run(
            'INSERT INTO users (fullname, email, phone, password) VALUES (?, ?, ?, ?)',
            [fullname, email, phone || null, hashedPassword]
        );
        
        // Create session for the new user
        const userId = result.lastID;
        const sessionId = uuidv4();
        const expireTime = new Date();
        expireTime.setDate(expireTime.getDate() + 30); // Session expires in 30 days
        
        await db.run(
            'INSERT INTO user_sessions (session_id, user_id, expire_time, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [sessionId, userId, expireTime.toISOString(), req.ip, req.headers['user-agent']]
        );
        
        // Update last login time
        await db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
            [userId]
        );
        
        // Get user data (without password)
        const user = await db.get('SELECT user_id, fullname, email, phone, created_at, last_login FROM users WHERE user_id = ?', [userId]);
        
        const userData = {
            user_id: user.user_id,
            fullname: user.fullname,
            email: user.email,
            phone: user.phone,
            created_at: user.created_at,
            last_login: user.last_login
        };
        
        res.json({
            success: true,
            message: 'Đăng ký thành công',
            user: userData,
            session: {
                sessionId,
                expireTime
            }
        });
    } catch (error) {
        console.error('Error registering user:', error);
        console.error('Error stack:', error.stack); // Add stack trace logging
        // Check for specific database errors if needed, but generic 500 with details is often sufficient
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng ký', details: error.message }); // Include error message in response
    }
});

app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
        }
        
        // Get user by email
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }
        
        // Check if user is blocked
        if (user.status === 'blocked') {
            return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa' });
        }
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }
        
        // Create new session
        const sessionId = uuidv4();
        const expireTime = new Date();
        expireTime.setDate(expireTime.getDate() + 30); // Session expires in 30 days
        
        await db.run(
            'INSERT INTO user_sessions (session_id, user_id, expire_time, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [sessionId, user.user_id, expireTime.toISOString(), req.ip, req.headers['user-agent']]
        );
        
        // Update last login time
        await db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
            [user.user_id]
        );
        
        // Get user data (without password)
        const userData = {
            user_id: user.user_id,
            fullname: user.fullname,
            email: user.email,
            phone: user.phone,
            created_at: user.created_at,
            last_login: user.last_login
        };
        
        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: userData,
            session: {
                sessionId,
                expireTime
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng nhập' });
    }
});

app.post('/api/users/logout', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        // Invalidate the session
        await db.run(
            'UPDATE user_sessions SET is_active = 0 WHERE session_id = ?',
            [sessionId]
        );
        
        res.json({
            success: true,
            message: 'Đăng xuất thành công'
        });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng xuất' });
    }
});

app.get('/api/users/profile', async (req, res) => {
    try {
        const sessionId = req.headers.authorization;
        
        if (!sessionId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if session exists and is valid
        const session = await db.get(
            'SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1 AND expire_time > CURRENT_TIMESTAMP',
            [sessionId]
        );
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        // Get user data
        const user = await db.get(
            'SELECT user_id, fullname, email, phone, created_at, last_login FROM users WHERE user_id = ?',
            [session.user_id]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Get bookings for the current user - MUST come before the :id route
app.get('/api/bookings/user', async (req, res) => {
    console.log('GET /api/bookings/user endpoint called');
    try {
        const sessionId = req.headers.authorization;
        console.log('Session ID:', sessionId);
        
        if (!sessionId) {
            console.log('No session ID provided');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if session exists and is valid
        const session = await db.get(
            'SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1 AND expire_time > CURRENT_TIMESTAMP',
            [sessionId]
        );
        console.log('Session found:', session ? 'Yes' : 'No');
        
        if (!session) {
            console.log('Invalid or expired session');
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        console.log('User ID from session:', session.user_id);
        
        // Get user's bookings
        const bookings = await db.all('SELECT * FROM bookings WHERE user_id = ? ORDER BY booking_time DESC', [session.user_id]);
        console.log(`Found ${bookings.length} bookings for user`);
        
        // Format bookings data for the client
        const formattedBookings = [];
        
        for (const booking of bookings) {
            console.log(`Processing booking ID: ${booking.booking_id}`);
            try {
                // Get departure flight
                const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
                
                // Get return flight if this is a round trip
                let returnFlight = null;
                if (booking.is_round_trip === 1 && booking.return_flight_id) {
                    returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.return_flight_id]);
                }
                
                // Get passengers
                const passengers = await db.all('SELECT * FROM booking_details WHERE booking_id = ?', [booking.booking_id]);
                console.log(`Found ${passengers.length} passengers for booking ${booking.booking_id}`);
                
                // Format the booking data
                const formattedBooking = {
                    id: booking.booking_id,
                    bookingNumber: booking.booking_id,
                    status: booking.payment_status,
                    bookingDate: booking.booking_time,
                    totalPrice: booking.total_amount,
                    flights: [
                        {
                            type: 'outbound',
                            flightNumber: departureFlight ? `${departureFlight.airline_code}${departureFlight.flight_number}` : 'N/A',
                            airline: departureFlight ? departureFlight.airline : 'N/A',
                            departureCode: departureFlight ? departureFlight.departure_airport : 'N/A',
                            arrivalCode: departureFlight ? departureFlight.arrival_airport : 'N/A',
                            departureTime: departureFlight ? departureFlight.departure_time : null,
                            arrivalTime: departureFlight ? departureFlight.arrival_time : null,
                            seatClass: booking.travel_class
                        }
                    ],
                    passengers: passengers.map(p => ({
                        name: p.full_name,
                        type: p.passenger_type.toLowerCase(),
                        passportNumber: p.passport_number
                    })),
                    contactInfo: {
                        name: booking.contact_name,
                        email: booking.email,
                        phone: booking.phone
                    },
                    payment: {
                        method: booking.payment_method || 'N/A',
                        status: booking.payment_status
                    }
                };
                
                // Add return flight if exists
                if (returnFlight) {
                    formattedBooking.flights.push({
                        type: 'return',
                        flightNumber: `${returnFlight.airline_code}${returnFlight.flight_number}`,
                        airline: returnFlight.airline,
                        departureCode: returnFlight.departure_airport,
                        arrivalCode: returnFlight.arrival_airport,
                        departureTime: returnFlight.departure_time,
                        arrivalTime: returnFlight.arrival_time,
                        seatClass: booking.travel_class
                    });
                }
                
                formattedBookings.push(formattedBooking);
            } catch (bookingError) {
                console.error(`Error processing booking ${booking.booking_id}:`, bookingError);
                // Continue with the next booking
            }
        }
        
        console.log(`Returning ${formattedBookings.length} formatted bookings`);
        res.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
    }
});

// Cancel a booking
app.post('/api/bookings/:id/cancel', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const sessionId = req.headers.authorization;
        
        if (!sessionId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if session exists and is valid
        const session = await db.get(
            'SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1 AND expire_time > CURRENT_TIMESTAMP',
            [sessionId]
        );
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        // Get the booking
        const booking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Check if the booking belongs to the user
        if (booking.user_id !== session.user_id) {
            return res.status(403).json({ error: 'You are not authorized to cancel this booking' });
        }
        
        // Check if the booking is already cancelled
        if (booking.payment_status === 'cancelled') {
            return res.status(400).json({ error: 'This booking is already cancelled' });
        }

        // Get departure flight details to check departure time
        const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
        
        if (!departureFlight) {
            return res.status(404).json({ error: 'Flight not found for this booking' });
        }
        
        // Check if the flight departure is at least 3 hours away
        const departureTime = new Date(departureFlight.departure_time);
        const currentTime = new Date();
        const timeDiffMs = departureTime - currentTime;
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60); // Convert milliseconds to hours
        
        if (timeDiffHours < 3) {
            return res.status(400).json({ 
                error: 'Không thể hủy chuyến bay. Chuyến bay chỉ có thể được hủy trước giờ khởi hành ít nhất 3 giờ.',
                departureDatetime: departureFlight.departure_time,
                currentDatetime: currentTime,
                hoursRemaining: timeDiffHours
            });
        }
        
        // Determine if a refund should be processed based on the current payment status
        const shouldRefund = booking.payment_status === 'paid';
        
        // Get the number of passengers in this booking
        const passengerCount = await db.get('SELECT COUNT(*) as count FROM booking_details WHERE booking_id = ?', [bookingId]);
        
        // Get the seat class used in the booking
        const seatClass = booking.travel_class || 'ECONOMY';
        
        // Determine which seat field to update based on the seat class
        let seatField;
        switch(seatClass) {
            case 'PREMIUM_ECONOMY':
                seatField = 'seats_premium_economy';
                break;
            case 'BUSINESS':
                seatField = 'seats_business';
                break;
            case 'FIRST':
                seatField = 'seats_first';
                break;
            case 'ECONOMY':
            default:
                seatField = 'seats_economy';
                break;
        }
        
        // Restore the seats to the flights - both class-specific and total
        await db.run(`
            UPDATE flights SET 
            ${seatField} = ${seatField} + ?,
            available_seats = available_seats + ? 
            WHERE flight_id = ?
        `, [passengerCount.count, passengerCount.count, booking.departure_flight_id]);
        
        // If this was a round trip, restore seats for the return flight too
        if (booking.is_round_trip === 1 && booking.return_flight_id) {
            await db.run(`
                UPDATE flights SET 
                ${seatField} = ${seatField} + ?,
                available_seats = available_seats + ? 
                WHERE flight_id = ?
            `, [passengerCount.count, passengerCount.count, booking.return_flight_id]);
        }
        
        // Update booking status to cancelled and set the should_refund flag
        await db.run(
            'UPDATE bookings SET payment_status = ?, should_refund = ?, cancelled_by_admin = ? WHERE booking_id = ?', 
            ['cancelled', shouldRefund ? 1 : 0, 0, bookingId]
        );
        
        res.json({ 
            success: true, 
            message: 'Booking cancelled successfully',
            bookingId: bookingId,
            shouldRefund: shouldRefund
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Failed to cancel booking', details: error.message });
    }
});

// Get details of a specific booking - MUST come after the /user route
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const sessionId = req.headers.authorization;
        
        if (!sessionId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Check if session exists and is valid
        const session = await db.get(
            'SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1 AND expire_time > CURRENT_TIMESTAMP',
            [sessionId]
        );
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        // Get the booking
        const booking = await db.get('SELECT * FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Check if the booking belongs to the user
        if (booking.user_id !== session.user_id) {
            return res.status(403).json({ error: 'You are not authorized to view this booking' });
        }
        
        // Get departure flight details
        const departureFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.departure_flight_id]);
        
        // Get return flight details if it's a round trip
        let returnFlight = null;
        if (booking.is_round_trip === 1 && booking.return_flight_id) {
            returnFlight = await db.get('SELECT * FROM flights WHERE flight_id = ?', [booking.return_flight_id]);
        }
        
        // Get passenger details
        const passengers = await db.all('SELECT * FROM booking_details WHERE booking_id = ?', [bookingId]);
        
        // Get contact details
        const contactDetails = await db.get('SELECT * FROM booking_contacts WHERE booking_id = ?', [bookingId]);
        
        // Format the booking details
        const formattedBooking = {
            bookingId: booking.booking_id,
            bookingNumber: booking.booking_number,
            bookingDate: booking.booking_date,
            userId: booking.user_id,
            paymentStatus: booking.payment_status,
            paymentMethod: booking.payment_method,
            totalPrice: booking.total_price,
            travelClass: booking.travel_class,
            isRoundTrip: booking.is_round_trip === 1,
            
            departureFlight: {
                flightId: departureFlight.flight_id,
                flightNumber: departureFlight.flight_number,
                departureAirport: departureFlight.departure_airport,
                arrivalAirport: departureFlight.arrival_airport,
                departureTime: departureFlight.departure_time,
                arrivalTime: departureFlight.arrival_time,
                airline: departureFlight.airline,
                aircraft: departureFlight.aircraft
            },
            
            returnFlight: returnFlight ? {
                flightId: returnFlight.flight_id,
                flightNumber: returnFlight.flight_number,
                departureAirport: returnFlight.departure_airport,
                arrivalAirport: returnFlight.arrival_airport,
                departureTime: returnFlight.departure_time,
                arrivalTime: returnFlight.arrival_time,
                airline: returnFlight.airline,
                aircraft: returnFlight.aircraft
            } : null,
            
            passengers: passengers.map(passenger => ({
                passengerId: passenger.passenger_id,
                firstName: passenger.first_name,
                lastName: passenger.last_name,
                dateOfBirth: passenger.date_of_birth,
                nationality: passenger.nationality,
                passportNumber: passenger.passport_number,
                passengerType: passenger.passenger_type
            })),
            
            contactDetails: contactDetails ? {
                contactId: contactDetails.contact_id,
                firstName: contactDetails.first_name,
                lastName: contactDetails.last_name,
                email: contactDetails.email,
                phone: contactDetails.phone
            } : null
        };
        
        res.json(formattedBooking);
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).json({ error: 'Failed to fetch booking details', details: error.message });
    }
});

// Admin API: Get all customers - Move this up before the catch-all route
// Delete the duplicate version further down
app.get('/api/admin/customers', async (req, res) => {
    console.log('Admin customers API called with query:', req.query);
    try {
        const { name, email, phone, page = 1, limit = 10 } = req.query;
        
        // Build query with filters
        let query = 'SELECT user_id, fullname, email, phone, created_at, last_login FROM users WHERE 1=1';
        const params = [];

        if (name) {
            query += ' AND fullname LIKE ?';
            params.push(`%${name}%`);
        }

        if (email) {
            query += ' AND email LIKE ?';
            params.push(`%${email}%`);
        }

        if (phone) {
            query += ' AND phone LIKE ?';
            params.push(`%${phone}%`);
        }

        // Count total records for pagination
        const countQuery = query.replace('SELECT user_id, fullname, email, phone, created_at, last_login', 'SELECT COUNT(*) as count');
        const countResult = await db.get(countQuery, params);
        const totalCount = countResult.count || 0;

        // Add pagination
        const offset = (page - 1) * limit;
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        // Get customers
        const customers = await db.all(query, params);

        // Get booking counts for each customer
        for (const customer of customers) {
            const bookingCount = await db.get('SELECT COUNT(*) as count FROM bookings WHERE user_id = ?', [customer.user_id]);
            customer.total_bookings = bookingCount.count || 0;
        }

        res.json({
            customers,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Admin API: Get single customer details
app.get('/api/admin/customers/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Get customer details
        const customer = await db.get(
            'SELECT user_id, fullname, email, phone, created_at, last_login, status FROM users WHERE user_id = ?', 
            [userId]
        );
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Get customer's bookings
        const bookings = await db.all(
            'SELECT booking_id, contact_name, email, phone, total_amount, booking_time, payment_status FROM bookings WHERE user_id = ? ORDER BY booking_time DESC',
            [userId]
        );
        
        // Return complete customer info
        res.json({
            customer,
            bookings
        });
    } catch (error) {
        console.error('Error fetching customer details:', error);
        res.status(500).json({ error: 'Failed to fetch customer details' });
    }
});

// Admin API: Create a new customer
app.post('/api/admin/customers', async (req, res) => {
    try {
        const { fullname, email, phone, address, dateOfBirth, gender, password } = req.body;
        
        // Validate required fields
        if (!fullname || !email) {
            return res.status(400).json({ error: 'Full name and email are required' });
        }
        
        // Check if email already exists
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already exists' });
        }
        
        // Generate a default password if not provided
        let hashedPassword;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        } else {
            // Default password is the first part of email + "123"
            const defaultPassword = email.split('@')[0] + '123';
            hashedPassword = await bcrypt.hash(defaultPassword, 10);
        }
        
        // Insert new user
        const result = await db.run(
            'INSERT INTO users (fullname, email, phone, password) VALUES (?, ?, ?, ?)',
            [fullname, email, phone || null, hashedPassword]
        );
        
        // Get the newly created user
        const newUser = await db.get(
            'SELECT user_id, fullname, email, phone, created_at FROM users WHERE user_id = ?',
            [result.lastID]
        );
        
        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            customer: newUser
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Admin API: Update a customer
app.put('/api/admin/customers/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { fullname, email, phone, status } = req.body;
        
        // Check if customer exists
        const existingUser = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
        if (!existingUser) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Check if email is being changed and already exists
        if (email !== existingUser.email) {
            const emailExists = await db.get('SELECT * FROM users WHERE email = ? AND user_id != ?', [email, userId]);
            if (emailExists) {
                return res.status(409).json({ error: 'Email already exists for another customer' });
            }
        }
        
        // Update user
        await db.run(
            'UPDATE users SET fullname = ?, email = ?, phone = ?, status = ? WHERE user_id = ?',
            [fullname, email, phone || null, status || existingUser.status, userId]
        );
        
        // Get the updated user
        const updatedUser = await db.get(
            'SELECT user_id, fullname, email, phone, created_at, last_login, status FROM users WHERE user_id = ?',
            [userId]
        );
        
        res.json({
            success: true,
            message: 'Customer updated successfully',
            customer: updatedUser
        });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Admin API: Delete a customer
app.delete('/api/admin/customers/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Check if customer exists
        const existingUser = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
        if (!existingUser) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Check if customer has any bookings
        const bookings = await db.get('SELECT COUNT(*) as count FROM bookings WHERE user_id = ?', [userId]);
        if (bookings.count > 0) {
            // Instead of deleting, set status to inactive
            await db.run('UPDATE users SET status = ? WHERE user_id = ?', ['inactive', userId]);
            
            return res.json({
                success: true,
                message: 'Customer has bookings and cannot be deleted. Status set to inactive.',
                status: 'inactive'
            });
        }
        
        // Delete any sessions
        await db.run('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
        
        // Delete the user
        await db.run('DELETE FROM users WHERE user_id = ?', [userId]);
        
        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Static file serving - moved to after API routes
app.use(express.static(path.join(__dirname, 'public')));

// Add a catch-all route for API requests debugging - This should be AFTER all API routes
app.use('/api', (req, res) => {
    console.log(`Unhandled API request: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'API route not found', 
        method: req.method,
        path: req.originalUrl,
        availableRoutes: [
            'GET /api/test',
            'GET /api/bookings/user',
            'GET /api/flights',
            'GET /api/flights/:id',
            'POST /api/bookings',
            'GET /api/bookings/:id',
            'PATCH /api/bookings/:id/payment',
            'POST /api/bookings/:id/cancel',
            'GET /api/admin/customers',
            'GET /api/admin/customers/:id',
            'POST /api/admin/customers',
            'PUT /api/admin/customers/:id',
            'DELETE /api/admin/customers/:id'
        ]
    });
});
