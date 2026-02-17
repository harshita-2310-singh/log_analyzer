const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
app.use(express.static("public"));


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

function fileFilter(req, file, cb) {
    const allowed = [".log", ".txt", ".out", ".err"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only log files allowed."));
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});


function detectLevel(line) {
    const u = line.toUpperCase();

    if (u.includes("ERROR") || u.includes("FATAL") || u.includes("CRITICAL"))
        return "ERROR";

    if (u.includes("WARNING") || u.includes("WARN"))
        return "WARNING";

    if (u.includes("DEBUG") || u.includes("TRACE") || u.includes("VERBOSE"))
        return "DEBUG";

    if (u.includes("INFO"))
        return "INFO";

    return "INFO";
}


function extractTimestamp(line) {
    const patterns = [
        /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/,        
        /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/,        
        /[A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2}/,      
        /\d{10,13}/                                      
    ];

    for (let p of patterns) {
        const match = line.match(p);
        if (match) return match[0];
    }

    return null;
}

app.post("/analyze", upload.single("logfile"), (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const filePath = req.file.path;

        const data = fs.readFileSync(filePath, "utf8");
        const lines = data.split("\n").filter(l => l.trim() !== "");

        let counts = {
            ERROR: 0,
            WARNING: 0,
            INFO: 0,
            DEBUG: 0
        };

        const entries = [];

        lines.forEach((line, index) => {
            const level = detectLevel(line);
            const ts = extractTimestamp(line);

            counts[level]++;

            entries.push({
                line: index + 1,
                level,
                ts,
                msg: line.trim()
            });
        });

     
        fs.unlinkSync(filePath);

        res.json({
            filename: req.file.originalname,
            totalLogs: lines.length,
            counts,
            entries
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error processing log file." });
    }
});


app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }

    if (err) {
        return res.status(400).json({ error: err.message });
    }

    next();
});


app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
});
