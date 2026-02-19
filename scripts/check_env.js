
require('dotenv').config();

const required = [
    "GETSTREAM_API_KEY",
    "GETSTREAM_API_SECRET",
    "GETSTREAM_APP_ID"
];

let missing = [];
let placeholders = [];

required.forEach(key => {
    const val = process.env[key];
    if (!val) {
        missing.push(key);
    } else if (val.includes("your_") || val.includes("YOUR_")) {
        placeholders.push(key);
    } else {
        console.log(`${key} is set and valid format.`);
    }
});

if (missing.length > 0) {
    console.error("Missing variables:", missing.join(", "));
}

if (placeholders.length > 0) {
    console.error("Placeholder variables found (invalid):", placeholders.join(", "));
    process.exit(1);
}

if (missing.length === 0 && placeholders.length === 0) {
    console.log("All GetStream variables are set and appear valid.");
}
