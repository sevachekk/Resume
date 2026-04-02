// --- UI / инициализация Telegram WebApp ---
const tg = window.Telegram?.WebApp || null;

if (tg) {
    try { tg.ready(); } catch (e) {}
    try { if (tg.expand) tg.expand(); } catch (e) {}
}

// --- Диагностика при старте ---
console.log('📱 TG version:', tg?.version);
console.log('📱 sendData available:', typeof tg?.sendData);
console.log('📱 showScanQrPopup available:', typeof tg?.showScanQrPopup);
console.log('📱 onEvent available:', typeof tg?.onEvent);
console.log('📱 initData present:', !!tg?.initData);

// =====================================================================
// URL твоего FastAPI сервера
// =====================================================================
const API_URL = 'https://circularly-predeterminate-adelaida.ngrok-free.dev/api/send-scaner-info/';

// --- Глобальные переменные ---
let alreadyHandled = false;

// Показываем всплывающее окно
function showPopup(message) {
    if (tg && typeof tg.showPopup === 'function') {
        tg.showPopup({
            title: 'Информация',
            message: String(message),
            buttons: [{ type: 'close' }]
        });
    } else {
        alert(message);
    }
}

// --- Отправка через fetch на FastAPI ---
async function sendViaApi(scannedText) {
    const user_id = tg?.initDataUnsafe?.user?.id;

    if (!user_id) {
        console.error('❌ user_id не определён в initDataUnsafe');
        showPopup('Не удалось определить пользователя. Попробуйте перезапустить.');
        return;
    }

    console.log('📡 Отправляем через API, user_id:', user_id);

    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                result_scan: scannedText,
                user_id: user_id
            })
        });

        if (resp.ok) {
            console.log('✅ API ответил успехом');
        } else {
            const data = await resp.json().catch(() => ({}));
            console.warn('⚠️ API вернул ошибку:', resp.status, data);
            showPopup('Ошибка сервера: ' + (data?.message || resp.status));
            return;
        }
    } catch (e) {
        console.error('❌ Ошибка fetch:', e);
        showPopup('Не удалось отправить данные. Проверьте соединение.');
        return;
    }

    // Закрываем Mini App после успешной отправки
    setTimeout(() => {
        if (tg?.close) tg.close();
    }, 300);
}

// Обработчик успешного сканирования
function handleScanned(scannedText, source = 'unknown') {
    if (alreadyHandled) {
        console.log('⚠️ Повторный вызов handleScanned проигнорирован, источник:', source);
        return;
    }
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

    // Останавливаем fallback-камеру если была запущена
    stopCameraFallback();

    // Отправляем только на API
    sendViaApi(String(scannedText));
}

// === НАСТРОЙКА СОБЫТИЯ qrTextReceived (ГЛАВНЫЙ СПОСОБ) ===
function setupQrEventListener() {
    if (!tg || typeof tg.onEvent !== 'function') {
        console.warn('⚠️ tg.onEvent недоступен');
        return;
    }

    tg.onEvent('qrTextReceived', (payload) => {
        console.log('📨 qrTextReceived сработал, payload:', payload);
        const scannedText = payload?.data || payload?.text || payload || null;
        if (scannedText) {
            handleScanned(String(scannedText), 'qrTextReceived');
        } else {
            console.warn('⚠️ qrTextReceived: пустой payload', payload);
        }
    });

    console.log('✅ Слушатель qrTextReceived установлен');
}

// --- Открытие нативного сканера Telegram ---
function openTelegramNativeScanner() {
    if (!tg) {
        console.warn('⚠️ Telegram WebApp API не найден. Запускаю fallback-камеру...');
        startCameraFallback();
        return;
    }

    alreadyHandled = false;

    if (typeof tg.showScanQrPopup === 'function') {
        try {
            // Результат приходит через qrTextReceived
            tg.showScanQrPopup({ text: 'Отсканируй СПБ QR-код' });
            console.log('✅ Нативный сканер Telegram открыт');
            return;
        } catch (e) {
            console.warn('⚠️ showScanQrPopup упал:', e);
        }
    }

    // Fallback для старых клиентов через postMessage
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
    } catch (e) {
        console.warn('⚠️ postMessage не сработал:', e);
    }

    console.warn('⚠️ Нативный сканер не поддерживается. Запускаю fallback-камеру...');
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

    if (!video || !canvas) {
        console.error('❌ Элементы video/canvas не найдены в DOM');
        return;
    }

    try {
        fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        video.srcObject = fallbackStream;
        await video.play();

        fallbackTrack = fallbackStream.getVideoTracks()[0];
        fallbackScanning = true;

        if (scannerLine) scannerLine.style.display = 'block';

        console.log('✅ Fallback-камера запущена');
        tickFallback();
    } catch (err) {
        console.error('❌ Ошибка камеры:', err);
        showPopup(
            err.name === 'NotAllowedError'
                ? 'Доступ к камере запрещён. Разрешите в настройках.'
                : 'Не удалось открыть камеру: ' + err.message
        );
    }
}

function stopCameraFallback() {
    if (!fallbackScanning) return;
    fallbackScanning = false;

    try {
        if (fallbackStream) fallbackStream.getTracks().forEach(t => t.stop());
    } catch (e) {}

    fallbackStream = null;
    fallbackTrack = null;

    const scannerLine = document.getElementById('scannerLine');
    if (scannerLine) scannerLine.style.display = 'none';

    console.log('🛑 Fallback-камера остановлена');
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
            inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
            console.log('✅ jsQR нашёл QR-код:', code.data);
            stopCameraFallback();
            handleScanned(code.data, 'fallback-jsQR');
            return;
        }
    }

    requestAnimationFrame(tickFallback);
}

// --- Запуск приложения ---
document.addEventListener('DOMContentLoaded', () => {
    // ПОРЯДОК ВАЖЕН: сначала слушатель, потом открываем сканер
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

// Глобальные функции для отладки в консоли
window.openTelegramNativeScanner = openTelegramNativeScanner;
window.startCameraFallback = startCameraFallback;
window.stopCameraFallback = stopCameraFallback;
