const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "db.json");

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large base64 attachments

// Seed default state if db.json doesn't exist
const initializeDatabase = () => {
  if (!fs.existsSync(DB_PATH)) {
    const defaultState = {
      stock: [
        { id: "s1", op: "OP-80120", clientName: "Comercial Araucanía S.A.", description: "Bolsa de Basura Negra 80x120 cm", undMts: 1500, kilos: 120, warehouse: "Industrial", date: "2026-06-10", observacion: "Lote listo en pallet 1" },
        { id: "s2", op: "OP-PP1000", clientName: "Agrícola Los Pinus Ltda.", description: "Envase Rectangular PP 1000cc", undMts: 800, kilos: 65, warehouse: "Industrial", date: "2026-06-11", observacion: "Guardado en estantería B" },
        { id: "s3", op: "OP-RI12", clientName: "Agrícola Los Pinus Ltda.", description: "Manguera Riego Tecnificada 1/2 pulgada", undMts: 300, kilos: 180, warehouse: "Agricola", date: "2026-06-11", observacion: "Rollos de 50 metros" },
        { id: "s4", op: "OP-CM4050", clientName: "Comercial Arauco", description: "Bolsa Camiseta Biodegradable 40x50 cm", undMts: 2500, kilos: 140, warehouse: "Agricola", date: "2026-06-12", observacion: "En cajas cerradas" },
        { id: "s5", op: "OP-PVC110", clientName: "Comercial Araucanía S.A.", description: "Tubería Sanitaria PVC 110mm x 6m", undMts: 120, kilos: 210, warehouse: "Industrial", date: "2026-06-12", observacion: "Apilado en patio" }
      ],
      customers: [
        { id: "c1", name: "Comercial Araucanía S.A.", rut: "76.120.340-5", sucursal: "Lautaro", vendedor: "Javier Ortiz", contacto: "Rodrigo Vera", phone: "+56 9 7788 9900", email: "adquisiciones@comercialaraucania.cl" },
        { id: "c2", name: "Agrícola Los Pinus Ltda.", rut: "15.890.342-K", sucursal: "Temuco Centro", vendedor: "Manuel Ardura", contacto: "Carlos Pinilla", phone: "+56 9 6655 4433", email: "contacto@agricolalospinus.cl" },
        { id: "c3", name: "Comercial Arauco", rut: "77.901.233-1", sucursal: "Lautaro", vendedor: "Marcos Alcayaga", contacto: "Alejandra Sol", phone: "+56 45 224 8899", email: "facturas@comercialarauco.cl" }
      ],
      notes: [],
      transportOrders: [],
      warehouseLog: [
        { id: "l1", date: "2026-06-10T09:30:00Z", type: "intake", op: "OP-80120", clientName: "Comercial Araucanía S.A.", warehouse: "Industrial", undMts: 1500, kilos: 120, reference: "Ingreso inicial de producción", user: "Sistema" },
        { id: "l2", date: "2026-06-11T11:00:00Z", type: "intake", op: "OP-PP1000", clientName: "Agrícola Los Pinus Ltda.", warehouse: "Industrial", undMts: 800, kilos: 65, reference: "Ingreso inicial de producción", user: "Sistema" },
        { id: "l3", date: "2026-06-11T14:15:00Z", type: "intake", op: "OP-RI12", clientName: "Agrícola Los Pinus Ltda.", warehouse: "Agricola", undMts: 300, kilos: 180, reference: "Ingreso inicial de producción", user: "Sistema" }
      ],
      usersList: [],
      profile: {
        name: "Plásticos Temuco",
        rut: "76.567.711-4",
        phone: "+56 45 221 4455",
        email: "contacto@plasticostemuco.cl",
        address: "Gustavo Verniory Lote 1f",
        city: "Lautaro Region de la Araucanía"
      },
      theme: "light"
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2), "utf8");
    console.log("Database seeded with default demo data.");
  }
};

initializeDatabase();

// API Endpoints
app.get("/api/state", (req, res) => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf8");
      return res.json(JSON.parse(data));
    }
    return res.status(404).json({ error: "Database not found" });
  } catch (error) {
    console.error("Error reading database:", error);
    res.status(500).json({ error: "Server error reading state" });
  }
});

app.post("/api/state", (req, res) => {
  try {
    const newState = req.body;
    if (!newState || typeof newState !== "object") {
      return res.status(400).json({ error: "Invalid state object" });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(newState, null, 2), "utf8");
    
    // Broadcast state updated to all active connections (except sender if handled, but broadcasting to all is safer)
    io.emit("state-updated");
    
    return res.json({ success: true });
  } catch (error) {
    console.error("Error writing database:", error);
    res.status(500).json({ error: "Server error writing state" });
  }
});

// Serve frontend static files
app.use(express.static(__dirname));

// Serve index.html as fallback for any request
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  PLASTEM ERP SERVER RUNNING ON PORT ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
