const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    session: { type: String, required: true },
    chatId: { type: String, required: true }
});

module.exports = mongoose.model('Account', accountSchema);
