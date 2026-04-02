
// --- UI / инициализация Telegram WebApp ---
const tg = window.Telegram?.WebApp || null;

// Инициализация WebApp
if (tg) {
    try { tg.ready(); } catch(e) {}
    try { if (tg.expand) tg.expand(); } catch(e) {}
}

// --- Общие переменные и helpers ---
let alreadyHandled = false;

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

// Отправить данные в бота (ОБНОВЛЁННАЯ ВЕРСИЯ)
function sendToTelegramBot(scannedText) {
    if (!scannedText) return;

    try {
        if (tg && typeof tg.sendData === 'function') {
            tg.sendData(String(scannedText));
            console.log('✅ Данные успешно отправлены в Telegram через tg.sendData');
            
            // Опционально: сразу закрываем Mini App после отправки
            // Раскомментируй, если хочешь автоматическое закрытие
            // if (tg.close) tg.close();
        } else {
            console.warn('tg.sendData не поддерживается в этом окружении');
            showPopup('⚠️ tg.sendData не поддерживается');
        }
    } catch (e) {
        console.error('Ошибка tg.sendData:', e);
        showPopup('❌ Ошибка отправки данных в Telegram');
    }
}

// Универсальный обработчик результата сканирования
function handleScanned(scannedText, source = 'telegram') {
    if (alreadyHandled) return;
    alreadyHandled = true;

    if (!scannedText) {
        showPopup('Пустой результат сканирования');
        return;
    }

    // Закрываем нативный QR-попап Telegram
    try {
        if (tg && typeof tg.closeScanQrPopup === 'function' && source === 'event') {
            tg.closeScanQrPopup();
        }
    } catch (e) { /* ignore */ }

    // Отправляем данные в бот
    sendToTelegramBot(scannedText);
}

// --- Попытка использовать нативный Telegram-сканер ---
function openTelegramNativeScanner() {
    if (!tg) {
        showPopup('Telegram WebApp API не найден. Открываю fallback-сканер...');
        startCameraFallback();
        return;
    }

    if (typeof tg.showScanQrPopup === 'function') {
        alreadyHandled = false;
        try {
            tg.showScanQrPopup({ text: 'Отсканируй СПБ QR-код' }, function(scannedText) {
                if (scannedText) {
                    handleScanned(scannedText, 'telegram-callback');
                    return true; // закрыть popup
                }
                return false;
            });

            // Подстраховка на событие
            if (typeof tg.onEvent === 'function') {
                tg.onEvent('qrTextReceived', (payload) => {
                    const text = payload?.text || payload || null;
                    handleScanned(text, 'event');
                });
            }
            return;
        } catch (e) {
            console.warn('showScanQrPopup failed:', e);
            showPopup('Нативный сканер недоступен. Открываю fallback-сканер...');
            startCameraFallback();
            return;
        }
    }

    // Fallback для старых клиентов
    try {
        if (window.parent && window.parent !== window) {
            const event = { 
                eventType: 'web_app_open_scan_qr_popup', 
                eventData: { text: 'Отсканируй СПБ QR-код' } 
            };
            window.parent.postMessage(JSON.stringify(event), '*');

            if (typeof tg?.onEvent === 'function') {
                tg.onEvent('qrTextReceived', payload => {
                    const text = payload?.text || payload || null;
                    handleScanned(text, 'event-postmessage');
                });
            }
            return;
        }
    } catch (e) { /* ignore */ }

    showPopup('Нативный сканер Telegram не поддерживается. Включаю fallback-сканер.');
    startCameraFallback();
}

// --- Fallback: камера + jsQR (остаётся без изменений) ---
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

// --- Запуск по загрузке страницы ---
document.addEventListener('DOMContentLoaded', () => {
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

    // Автозапуск нативного сканера Telegram
    openTelegramNativeScanner();
});

// Глобальные функции для отладки
window.openTelegramNativeScanner = openTelegramNativeScanner;
window.startCameraFallback = startCameraFallback;
window.stopCameraFallback = stopCameraFallback;

