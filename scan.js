// ====================== scan.js (чистая версия — только tg.sendData) ======================

const tg = window.Telegram?.WebApp || null;

let alreadyHandled = false;
let fallbackStream = null;
let fallbackTrack = null;
let fallbackScanning = false;

function showPopup(message) {
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({ title: 'Информация', message: String(message), buttons: [{type: 'close'}] });
    } else {
        alert(message);
    }
}

function sendToTelegramBot(scannedText) {
    if (!scannedText) return;

    try {
        if (tg && typeof tg.sendData === 'function') {
            tg.sendData(String(scannedText));
        }
    } catch (e) {
        console.warn('tg.sendData error:', e);
    }

    showPopup('✅ QR-код успешно отправлен в бот');
}

function handleScanned(scannedText, source = 'telegram') {
    if (alreadyHandled) return;
    alreadyHandled = true;

    if (!scannedText) {
        showPopup('Пустой результат сканирования');
        return;
    }

    if (tg && typeof tg.closeScanQrPopup === 'function' && source === 'event') {
        tg.closeScanQrPopup();
    }

    sendToTelegramBot(scannedText);
}

// ====================== НАТИВНЫЙ СКАНЕР TELEGRAM ======================
function openTelegramNativeScanner() {
    if (!tg) {
        showPopup('Telegram WebApp API не найден. Запускаю камеру...');
        startCameraFallback();
        return;
    }

    if (typeof tg.showScanQrPopup === 'function') {
        alreadyHandled = false;
        try {
            tg.showScanQrPopup({ text: 'Отсканируй СПБ QR-код' }, function (scannedText) {
                if (scannedText) {
                    handleScanned(scannedText, 'telegram-callback');
                    return true;
                }
                return false;
            });

            if (typeof tg.onEvent === 'function') {
                tg.onEvent('qrTextReceived', (payload) => {
                    const text = payload?.text || payload || null;
                    if (text) handleScanned(text, 'event');
                });
            }
            return;
        } catch (e) {
            console.warn('showScanQrPopup failed:', e);
        }
    }

    showPopup('Нативный сканер недоступен. Запускаю камеру...');
    startCameraFallback();
}

// ====================== FALLBACK КАМЕРА + jsQR ======================
async function startCameraFallback() {
    if (fallbackScanning) return;
    alreadyHandled = false;

    const video = document.getElementById('video');
    const scannerLine = document.getElementById('scannerLine');

    try {
        fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
    if (fallbackStream) fallbackStream.getTracks().forEach(t => t.stop());
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
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

        if (code && code.data) {
            stopCameraFallback();
            handleScanned(code.data, 'fallback');
            return;
        }
    }
    requestAnimationFrame(tickFallback);
}

// ====================== ЗАПУСК ======================
document.addEventListener('DOMContentLoaded', () => {
    if (tg) {
        try { tg.ready(); tg.expand(); } catch(e) {}
    }
    openTelegramNativeScanner();
});

window.openTelegramNativeScanner = openTelegramNativeScanner;
window.startCameraFallback = startCameraFallback;
window.stopCameraFallback = stopCameraFallback;
