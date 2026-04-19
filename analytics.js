(function () {
    const USER_ID = localStorage.getItem("uid") || crypto.randomUUID();
    localStorage.setItem("uid", USER_ID);

    const SITE = window.location.origin;
    const ANALYTICS_ENDPOINT = "http://127.0.0.1:5050/track"; 
    // 👆 later replace with your public URL (Render etc.)

    let startTime = Date.now();

    function buildPayload(event, extra = {}) {
        return {
            user_id: USER_ID,
            site: SITE,
            event,
            time: new Date().toISOString(),
            duration: Math.floor((Date.now() - startTime) / 1000),
            ...extra
        };
    }

    function sendToServer(data) {
        fetch(ANALYTICS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }).catch(() => {
            // fail silently so site never breaks
        });
    }

    function log(event) {
        const data = buildPayload(event);

        // local backup (always works)
        let logs = JSON.parse(localStorage.getItem("analytics_logs") || "[]");
        logs.push(data);
        localStorage.setItem("analytics_logs", JSON.stringify(logs));

        // send to server (if available)
        sendToServer(data);

        console.log("Analytics Event:", data);
    }

    // page load
    log("page_load");

    // heartbeat every 30s
    setInterval(() => {
        log("heartbeat");

        const mins = (Date.now() - startTime) / 60000;

        if (mins >= 30 && !window._longSessionSent) {
            window._longSessionSent = true;
            log("long_session_30min");
        }

    }, 30000);

    // page exit
    window.addEventListener("beforeunload", () => {
        log("page_exit");
    });

})();