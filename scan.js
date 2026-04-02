// --- UI / инициализация Telegram WebApp ---
const tg = window.Telegram?.WebApp || null;

if (tg) {
    try { tg.ready(); } catch(e) {}
    try { if (tg.expand) tg.expand(); } catch(e) {}
}

// --- Глобальные переменные ---
let alreadyHandled = false;

// Показываем всплывающее окно
function showPopup(message) {
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({
            title: 'Информация',
            message: String(message),
            buttons: [{type: 'close'}]
        });
    } else {
        alert(message);
    }
}

// Отправка данных в бот
function sendToTelegramBot(scannedText) {
    if (!scannedText) return;

    console.log('📤 Отправляем в бот:', scannedText);

    try {
        if (tg && typeof tg.sendData === 'function') {
            tg.sendData(String(scannedText));
            console.log('✅ tg.sendData успешно вызван — Mini App должен закрыться');

            // Принудительно закрываем Mini App
            setTimeout(() => {
                if (tg.close) tg.close();
            }, 300);
        } else {
            console.warn('tg.sendData не поддерживается');
            showPopup('⚠️ tg.sendData не поддерживается в этом клиенте');
        }
    } catch (e) {
        console.error('Ошибка tg.sendData:', e);
        showPopup('❌ Ошибка отправки данных в Telegram');
    }
}

// Обработчик успешного сканирования
function handleScanned(scannedText, source = 'unknown') {
    if (alreadyHandled) return;
    alreadyHandled = true;

    console.log(`🔍 Сканирование успешно! Источник: ${source} | Текст:`, scannedText);

    if (!scannedText) {
        showPopup('Пустой результат сканирования');
        return;
    }

    // Закрываем нативный попап
    try {
        if (tg && typeof tg.closeScanQrPopup === 'function') {
            tg.closeScanQrPopup();
        }
    } catch (e) {}

    sendToTelegramBot(scannedText);
}

// === НАСТРОЙКА СОБЫТИЯ qrTextReceived (ГЛАВНЫЙ СПОСОБ) ===
function setupQrEventListener() {
    if (!tg || typeof tg.onEvent !== 'function') return;

    tg.onEvent('qrTextReceived', (payload) => {
        const scannedText = payload?.data || payload?.text || payload || null;
        if (scannedText) {
            handleScanned(scannedText, 'qrTextReceived');
        }
    });

    console.log('✅ Слушатель qrTextReceived установлен');
}

// --- Открытие нативного сканера Telegram ---
function openTelegramNativeScanner() {
    if (!tg) {
        showPopup('Telegram WebApp API не найден. Запускаю fallback-камеру...');
        startCameraFallback();
        return;
    }

    alreadyHandled = false;

    if (typeof tg.showScanQrPopup === 'function') {
        try {
            tg.showScanQrPopup(
                { text: 'Отсканируй СПБ QR-код' },
                function (scannedText) {
                    if (scannedText) {
                        handleScanned(scannedText, 'showScanQrPopup-callback');
                        return false;        // ←←← ОБЯЗАТЕЛЬНО false
                    }
                    return false;
                }
            );
            console.log('✅ Нативный сканер Telegram открыт');
            return;
        } catch (e) {
            console.warn('showScanQrPopup упал:', e);
        }
    }

    // 2. Fallback для старых клиентов через postMessage
    try {
        if (window.parent && window.parent !== window) {
            const event = {
                eventType: 'web_app_open_scan_qr_popup',
                eventData: { text: 'Отсканируй СПБ QR-код' }
            };
            window.parent.postMessage(JSON.stringify(event), '*');
            console.log('✅ Отправлен postMessage для открытия сканера');
            return;
        }
    } catch (e) {}

    showPopup('Нативный сканер не поддерживается. Запускаю fallback-камеру...');
    startCameraFallback();
}

// --- Fallback: камера + jsQR ---
let fallbackStream = null;
let fallbackTrack = null;
let fallbackScanning = false;

async function startCameraFallback() {
    if (fallbackScanning) return;
    alreadyHandled = false;

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const scannerLine = document.getElementById('scannerLine');

    try {
        fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = fallbackStream;
        await video.play();
        fallbackTrack = fallbackStream.getVideoTracks()[0];
        fallbackScanning = true;
        if (scannerLine) scannerLine.style.display = 'block';
        tickFallback();
    } catch (err) {
        console.error('Ошибка камеры:', err);
        showPopup(err.name === 'NotAllowedError' 
            ? 'Доступ к камере запрещён. Разрешите в настройках.' 
            : 'Не удалось открыть камеру: ' + err.message);
    }
}

function stopCameraFallback() {
    fallbackScanning = false;
    try {
        if (fallbackStream) fallbackStream.getTracks().forEach(t => t.stop());
    } catch(e){}
    fallbackStream = null;
    fallbackTrack = null;
    const scannerLine = document.getElementById('scannerLine');
    if (scannerLine) scannerLine.style.display = 'none';
}

function tickFallback() {
    if (!fallbackScanning) return;

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { 
            inversionAttempts: "dontInvert" 
        });

        if (code && code.data) {
            stopCameraFallback();
            handleScanned(code.data, 'fallback');
            return;
        }
    }
    requestAnimationFrame(tickFallback);
}

// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем слушатель события qrTextReceived
    setupQrEventListener();

    const torchBtn = document.getElementById('torchBtn');
    if (torchBtn) {
        torchBtn.addEventListener('click', () => {
            if (!fallbackTrack) {
                showPopup('Фонарик доступен только в режиме камеры (fallback).');
                return;
            }
            const caps = fallbackTrack.getCapabilities ? fallbackTrack.getCapabilities() : {};
            if (caps.torch) {
                const settings = fallbackTrack.getSettings() || {};
                const current = settings.torch || false;
                fallbackTrack.applyConstraints({ 
                    advanced: [{ torch: !current }] 
                }).catch(() => {
                    showPopup('Не удалось переключить фонарик.');
                });
            } else {
                showPopup('Фонарик не поддерживается на этом устройстве.');
            }
        });
    }

    // Автозапуск сканера
    openTelegramNativeScanner();
});

// Глобальные функции для отладки
window.openTelegramNativeScanner = openTelegramNativeScanner;
window.startCameraFallback = startCameraFallback;
window.stopCameraFallback = stopCameraFallback;
