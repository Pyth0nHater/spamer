const fs = require('fs');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const Config = require('../models/Config'); 
const Account = require('../models/Account'); 


const addConfig = async (bot, chatId) => {
    let usernames = [];
    let batchSize = null;
    let waitTime = null;
    let messageText = null;
    let currentStepMessage;
    let ownerSession = null;
    let accountName = null;
    let configName = null;
    let time;

    const updateMessage = async (text) => {
        if (currentStepMessage) {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: currentStepMessage.message_id,
            });
        } else {
            currentStepMessage = await bot.sendMessage(chatId, text);
        }
    };

    // Step 0: Выбор сессии
    const step0 = async () => {
        // Получение сессий из MongoDB только для текущего chatId
        try {
            const sessions = await Account.find({ chatId: chatId });
            
            if (sessions.length > 0) {
                await bot.sendMessage(chatId, 'Выберите сессию:', {
                    reply_markup: {
                        inline_keyboard: sessions.map(session => [
                            {
                                text: session.name,
                                callback_data: session._id
                            }
                        ])
                    }
                });
            } else {
                await bot.sendMessage(chatId, 'У вас нет доступных сессий.');
            }
        } catch (err) {
            console.error('Ошибка получения сессий из базы данных:', err);
        }

        bot.on('callback_query', async (callbackQuery) => {
            const sessionId = callbackQuery.data;
            const account = await Account.findOne({ _id: sessionId });

            ownerSession = account.session
            accountName = account.name


            step1(); // Переход к следующему шагу после выбора сессии
        });
    };

    const step1 = async () => {
        await bot.sendMessage(chatId, "Пожалуйста, загрузите файл .txt с сслыками на чаты(каждый чат на новой строке):");

        return new Promise((resolve) => {
            const documentHandler = async (msg) => {
                if (msg.document) {
                    const fileId = msg.document.file_id;
                    const filePath = await bot.downloadFile(fileId, './');

                    try {
                        const fileData = fs.readFileSync(filePath, 'utf-8');
                        usernames = fileData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                        await updateMessage(`Найдено ${usernames.length} чатов.`);
                        bot.removeListener('message', documentHandler);
                        step2();
                    } catch (error) {
                        console.error('Ошибка при чтении файла:', error);
                        await updateMessage("Ошибка при чтении файла. Попробуйте снова загрузить файл.");
                    }
                } else {
                    await updateMessage("Пожалуйста, загрузите файл в формате .txt.");
                }
            };

            bot.on('message', documentHandler);
        });
    };

    const step2 = async () => {
        await bot.sendMessage(chatId, "Введите размер партии(рекомендуемо: 6)");

        const batchSizeHandler = async (msg) => {
            const size = parseInt(msg.text, 10);

            if (!isNaN(size)) {
                batchSize = size;
                bot.removeListener('message', batchSizeHandler);
                step3();
            } else {
                await updateMessage("Пожалуйста, введите корректное число для размера партии:");
            }
        };

        bot.on('message', batchSizeHandler);
    };

    const step3 = async () => {
        await bot.sendMessage(chatId, "Введите время задержки секунд между партиями(рекомендуемо: 900)");

        const waitTimeHandler = async (msg) => {
            time = parseInt(msg.text, 10);

            if (!isNaN(time)) {
                waitTime = time * 1000;
                bot.removeListener('message', waitTimeHandler);
                step4();
            } else {
                await updateMessage("Пожалуйста, введите корректное число для времени задержки:");
            }
        };

        bot.on('message', waitTimeHandler);
    };

    const step4 = async () => {
        await bot.sendMessage(chatId, "Введите сообщение для рассылки:");

        const messageHandler = async (msg) => {
            messageText = msg.text;

            if (messageText) {
                bot.removeListener('message', messageHandler);
                step5();
            } else {
                await updateMessage("Пожалуйста, введите сообщение:");
            }
        };

        bot.on('message', messageHandler);
    };

    const step5 = async () => {
        await bot.sendMessage(chatId, "Введите название конфига");

        const messageHandler = async (msg) => {
            configName = msg.text;

            if (messageText) {
                await bot.removeListener('message', messageHandler);
                try {
                    await Config.create({
                        chatId: chatId,
                        configName: configName,
                        configSession: ownerSession,
                        sessionName: accountName,
                        chats: usernames,
                        message: messageText,
                        delay: waitTime,
                        bathSize: batchSize,
                        session: ownerSession
                    });
                    bot.sendMessage(chatId, 'Новый конфиг добавлен.');
                } catch (error) {
                    console.error('Ошибка при записи в MongoDB:', error);
                    bot.sendMessage(chatId, 'Произошла ошибка при сохранении сессии.');
                }
            } else {
                await updateMessage("Пожалуйста, введите сообщение:");
            }
        };

        await bot.on('message', messageHandler);
    };


    // Запуск процесса с первого шага (выбора сессии)
    await step0();
};

module.exports = { addConfig };
