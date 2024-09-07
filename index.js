const TelegramBot = require('node-telegram-bot-api');
const { TelegramClient, Logger } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
const fs = require('fs'); // Для работы с файлами
const { link } = require('fs/promises');

const API_ID = 25171031;
const API_HASH = "10f7696a65a7217fad43302ea6ba1695";
const BOT_TOKEN = "6367374872:AAHdjQNVzrC-WyVp-_4sQDDU8PQ7mpvkoA8";
const ownerSession = new StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu6diX80UbU8xXI719W5swc+XSuuAh8C+s4Bau1aqaCgssJIfDHnZNk4UKTDjhKp0JXr69Sgu5uqyApsemv3995rHVgU6KWOj12QgXwtgGUa5iX+Jq0LSekFh6goN+F67BNs4zEaQmgZbcqnunLtiEQCcmTzTQT50MrgkUhJ3B0ZPEUZ+8mbHtdAt8sAFR+KKOkBqLtBsuHO1nWz6Y2JhSz39WUvmYR+8jxjQjsF80rbhVLDtvgPALjU2FTbFHCS+UMnA9Kw/dYgMlnb1wyj4pcvHGsdwJ5Fz3u8eOLvpsemW+yDEpyn6lKQ1kXmnGwak9CIWaweQ7v5f59bewMgAwLI=");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const addSession = async (chatId) => {
    bot.sendMessage(chatId, "Запуск процесса добавления новой учетной записи...");

    const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
        baseLogger: new Logger('warn'),
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => {
            bot.sendMessage(chatId, "Введите ваш номер телефона:");
            return new Promise((resolve) => {
                bot.once('message', (msg) => resolve(msg.text));
            });
        },
        password: async () => {
            bot.sendMessage(chatId, "Введите ваш пароль:");
            return new Promise((resolve) => {
                bot.once('message', (msg) => resolve(msg.text));
            });
        },
        phoneCode: async () => {
            let code = "";
            let sentMessage;

            // Функция для обновления сообщения с текущим кодом
            const updateMessage = async () => {
                if (sentMessage) {
                    await bot.editMessageText(`Текущий код: ${code || '(пусто)'}`, {
                        chat_id: chatId,
                        message_id: sentMessage.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                ['1', '2', '3'].map((num) => ({ text: num, callback_data: num })),
                                ['4', '5', '6'].map((num) => ({ text: num, callback_data: num })),
                                ['7', '8', '9'].map((num) => ({ text: num, callback_data: num })),
                                [{ text: '0', callback_data: '0' }, { text: 'Удалить', callback_data: 'delete' }]
                            ]
                        }
                    });
                } else {
                    sentMessage = await bot.sendMessage(chatId, `Текущий код: ${code || '(пусто)'}`, {
                        reply_markup: {
                            inline_keyboard: [
                                ['1', '2', '3'].map((num) => ({ text: num, callback_data: num })),
                                ['4', '5', '6'].map((num) => ({ text: num, callback_data: num })),
                                ['7', '8', '9'].map((num) => ({ text: num, callback_data: num })),
                                [{ text: '0', callback_data: '0' }, { text: 'Удалить', callback_data: 'delete' }]
                            ]
                        }
                    });
                }
            };

            await updateMessage();

            return new Promise((resolve) => {
                bot.on('callback_query', async (query) => {
                    const data = query.data;

                    if (data === 'delete') {
                        code = code.slice(0, -1); // Удаление последней цифры
                    } else {
                        code += data; // Добавление новой цифры
                    }

                    await updateMessage(); // Редактирование сообщения

                    if (code.length === 5) { // Предположим, что код состоит из 5 цифр
                        resolve(code); // Возвращаем введенный код
                    }

                    bot.answerCallbackQuery(query.id); // Закрытие окна с инлайн-ответом
                });
            });
        },
        onError: (err) => console.error(err),
    });

    const sessionString = client.session.save(); // Сохраните эту строку, чтобы не заходить в систему снова

    // Запросить имя учетной записи
    bot.sendMessage(chatId, "Усешный вход\nВведите имя для этой учетной записи:");
    const accountName = await new Promise((resolve) => {
        bot.once('message', (msg) => resolve(msg.text));
    });

    const accountData = JSON.parse(fs.readFileSync('Accounts.json', 'utf-8'));
    accountData.sessions.push({ name: accountName, session: sessionString });
    fs.writeFileSync('Accounts.json', JSON.stringify(accountData, null, 2));

    bot.sendMessage(chatId, 'Добавлена новая сессия');
};


const sendMessagesInBatches = async (client, chatId) => {
    let usernames = [];
    let batchSize = null;
    let waitTime = null;
    let messageText = null;
    let currentStepMessage;

    fs.readFile('Accounts.json', 'utf8', (err, data) => {
        if (err) {
          console.error('Ошибка чтения файла:', err);
          return;
        }
        
        try {
          const accounts = JSON.parse(data);

          console.log(accounts);
          
        } catch (err) {
          console.error('Ошибка парсинга JSON:', err);
        }
      });


    // Функция для редактирования сообщения с текущим состоянием
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
    

    // Шаг 1: Загрузка файла с именами пользователей
    await bot.sendMessage(chatId, "Пожалуйста, загрузите файл .txt с именами пользователей (каждый пользователь на новой строке):");

    return new Promise((resolve) => {
        const documentHandler = async (msg) => {
            if (msg.document) {
                const fileId = msg.document.file_id;
                const filePath = await bot.downloadFile(fileId, './'); // Скачиваем файл

                try {
                    const fileData = fs.readFileSync(filePath, 'utf-8');
                    usernames = fileData.split('\n').map(line => line.trim()).filter(line => line.length > 0); // Чтение и разбор файла
                    await updateMessage(`Файл загружен. Найдено пользователей: ${usernames.length}\nПереход к следующему шагу.`);
                    bot.removeListener('message', documentHandler);
                    step2(); // Переход к следующему шагу
                } catch (error) {
                    console.error('Ошибка при чтении файла:', error);
                    await updateMessage("Ошибка при чтении файла. Попробуйте снова загрузить файл.");
                }
            } else {
                await updateMessage("Пожалуйста, загрузите файл в формате .txt.");
            }
        };

        bot.on('message', documentHandler);

        const step2 = async () => {
            // Шаг 2: Ввод размера партии
            await bot.sendMessage(chatId, "Введите размер партии");

            const batchSizeHandler = async (msg) => {
                const size = parseInt(msg.text, 10);

                if (!isNaN(size)) {
                    batchSize = size;
                    bot.removeListener('message', batchSizeHandler);
                    step3(); // Переход к следующему шагу
                } else {
                    await updateMessage("Пожалуйста, введите корректное число для размера партии:");
                }
            };

            bot.on('message', batchSizeHandler);
        };

        const step3 = async () => {
            // Шаг 3: Ввод времени задержки
            await bot.sendMessage(chatId, "Введите время задержки между партиями (в миллисекундах):");

            const waitTimeHandler = async (msg) => {
                const time = parseInt(msg.text, 10);

                if (!isNaN(time)) {
                    waitTime = time;
                    bot.removeListener('message', waitTimeHandler);
                    step4(); // Переход к следующему шагу
                } else {
                    await updateMessage("Пожалуйста, введите корректное число для времени задержки:");
                }
            };

            bot.on('message', waitTimeHandler);
        };

        const step4 = async () => {
            // Шаг 4: Ввод сообщения для отправки
            await bot.sendMessage(chatId, "Введите сообщение для рассылки:");

            const messageHandler = async (msg) => {
                messageText = msg.text;

                if (messageText) {
                    bot.removeListener('message', messageHandler);
                    sendMessages(); // Переход к отправке сообщений
                } else {
                    await updateMessage("Пожалуйста, введите сообщение:");
                }
            };

            bot.on('message', messageHandler);
        };

        const sendMessages = async () => {
            // Шаг 5: Отправка сообщений
            await bot.sendMessage(chatId,`Отправка сообщений...\nПользователи: ${usernames.join(', ')}\nРазмер партии: ${batchSize}\nЗадержка: ${waitTime} мс\nСообщение: ${messageText}`);

            for (let i = 0; i < usernames.length; i += batchSize) {
                const batch = usernames.slice(i, i + batchSize);
                for (const username of batch) {
                    try {
                        const entity = await client.getEntity(username);
                        await sleep(1000); // Пауза между сообщениями
                        await client.invoke(
                            new Api.messages.SendMessage({
                                peer: entity,
                                message: messageText,
                                randomId: BigInt(-Math.floor(Math.random() * 1e12)),
                                noWebpage: true,
                                noforwards: true,
                            })
                        );
                        console.log(`Сообщение отправлено: ${username}`);
                    } catch (error) {
                        if (error.errorMessage === 'FLOOD') {
                            console.error(`Не удалось отправить сообщение ${username}: Включен режим медленной отправки. Подождите ${error.seconds} секунд.`);
                        } else {
                            console.error(`Не удалось отправить сообщение ${username}:`, error);
                        }
                    }
                }
                if (i + batchSize < usernames.length) {
                    console.log(`Ожидание ${waitTime / 1000} секунд перед следующей партией...`);
                    await sleep(waitTime);
                }
            }

            await updateMessage("Все сообщения были отправлены.");
            resolve(); // Завершение процесса
        };
    });
};


bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'AddAccount') {
        await addSession(chatId);
    } else if (data === 'MyAccounts') {
        // Логика для отображения списка аккаунтов
        const accountData = JSON.parse(fs.readFileSync('Accounts.json', 'utf-8'));
        const accountsList = accountData.sessions.map(acc => acc.name).join('\n');
        bot.sendMessage(chatId, `Ваши аккаунты:\n${accountsList}`);
    } else if (data === 'SendMessages') {
        // Запуск процесса отправки сообщений
        bot.sendMessage(chatId, 'Начинаем процесс отправки сообщений. Пожалуйста, следуйте инструкциям.');
        
        // Создаем клиент Telegram и запускаем его
        const client = new TelegramClient(ownerSession, API_ID, API_HASH);
        await client.start();

        // Запускаем процесс отправки сообщений
        await sendMessagesInBatches(client, chatId);

        // Сообщение по завершению процесса отправки
        bot.sendMessage(chatId, 'Процесс отправки сообщений завершен.');
    } else if (data === 'closeMenu') {
        bot.sendMessage(chatId, 'Меню закрыто.');
    }
});



const userStates = {};

// Инициализация обработчика команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Инициализация состояния для нового чата
    userStates[chatId] = { step: 'ask_chats', data: {} };
    bot.sendMessage(chatId, 'Отправьте файл с чатами');
});



bot.onText(/\/menu/, async (msg) => {
    await bot.sendMessage(msg.chat.id, `Меню`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Мои аккаунты', callback_data: 'MyAccounts' }, { text: 'Добавить аккаунт', callback_data: 'AddAccount' }],
                [{ text: 'Купить Файл', callback_data: 'buyFile' }],
                [{ text: 'Проверить Подписку', callback_data: 'checkSubs' }],
                [{ text: 'Начать рассылку', callback_data: 'SendMessages' }]
            ]
        }
    });
});


// Обработка загрузки документов
bot.on('document',  (msg) => {
    const chatId = msg.chat.id;

    // Проверка, существует ли состояние для этого чата
    if (!userStates[chatId]) {
        bot.sendMessage(chatId, 'Пожалуйста, начните с /start');
        return;
    }

    const fileId = msg.document.file_id;

    if (!fileId) {
        bot.sendMessage(chatId, 'Не удалось получить файл. Пожалуйста, попробуйте снова.');
        return;
    }

    try {
        const filePath =  bot.downloadFile(fileId, "./");
        sleep(2000)
        const fileData = fs.readFileSync(filePath, 'utf-8');
        console.log(userStates[chatId])
        // Сохранение данных чатов и переход к следующему шагу
        userStates[chatId].chats = fileData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log(`Полученные чаты: ${userStates[chatId].data.chats}`);
        
        userStates[chatId].step = 'ask_mess';
        bot.sendMessage(chatId, 'Введите сообщение для отправки');
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при загрузке файла.');
    }
});

// bot.on('message', (msg) => {
//     const chatId = msg.chat.id;

//     if (msg.text && msg.text.startsWith('/')) {
//         return;
//     }

//     // if (!userStates[chatId]) {
//     //     bot.sendMessage(chatId, 'Пожалуйста, начните с /start');
//     //     return;
//     // }

//     const state = userStates[chatId];

//     switch (state.step) {
//         case 'ask_mess':
//             console.log(state.data.chat)
//             state.data.message = msg.text;
//             state.step = 'ask_batch';
//             bot.sendMessage(chatId, 'Введите размер партии');
//             break;

//         case 'ask_batch':
//             state.data.batchSize = parseInt(msg.text, 10);
//             state.step = 'ask_delay';
//             bot.sendMessage(chatId, 'Введите задержку между партиями (в миллисекундах)');
//             break;

//         case 'ask_delay':
//             state.data.waitTime = parseInt(msg.text, 10);
//             state.step = 'finished';

//             const client = new TelegramClient(ownerSession, API_ID, API_HASH);
//             client.start().then(() => {
//                 sendMessagesInBatches(client, state.data.chats, state.data.batchSize, state.data.waitTime, state.data.message);
//                 bot.sendMessage(
//                     chatId,
//                     `Сообщения отправляются в чаты: ${state.data.chats}\nРазмер партии: ${state.data.batchSize}\nЗадержка: ${state.data.waitTime} мс\nСообщение: ${state.data.message}`
//                 );
//                 delete userStates[chatId];
//             }).catch(error => {
//                 console.error('Ошибка при запуске клиента Telegram:', error);
//                 bot.sendMessage(chatId, 'Произошла ошибка при запуске клиента Telegram.');
//             });
//             break;

//         case 'finished':
//             bot.sendMessage(chatId, 'Ты уже завершил ввод данных. Для начала снова используй /start');
//             break;

//         default:
//             bot.sendMessage(chatId, 'Произошла ошибка. Попробуй снова /start');
//             delete userStates[chatId];
//             break;
//     }
// });

bot.on('polling_error', (error) => {
    console.log(`Ошибка опроса: ${error.code} - ${error.message}`);
});
