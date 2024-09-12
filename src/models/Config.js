const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    chatId: { type: String, required: true },
    configName: { type: String, required: true },
    sessionName:  { type: String, required: true },
    chats: { type: [String], required: true },
    message: { type: String, required: true },
    delay: { type: Number, required: true },
    bathSize: { type: Number, required: true },
    session: { type: String, required: true }
});

module.exports = mongoose.model('Config', accountSchema);
