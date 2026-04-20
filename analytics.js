(function () {
    const ENDPOINT = "http://127.0.0.1:5050/track"; 
    const SITE = "https://joeljourneys.com";

    const USER_ID =
        localStorage.getItem("jj_uid") ||
        crypto.randomUUID();

    localStorage.setItem("jj_uid", USER_ID);

    let startTime = Date.now();

    function send(event, extra = {}) {
        const payload = {
            user_id: USER_ID,
            site: SITE,
            event,
            time: new Date().toISOString(),
            duration: Math.floor((Date.now() - startTime) / 1000),
            ...extra
        };

        // backup locally
        let logs = JSON.parse(localStorage.getItem("jj_logs") || "[]");
        logs.push(payload);
        localStorage.setItem("jj_logs", JSON.stringify(logs));

        // send to agent
        fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }

    // EVENTS
    send("page_load");

    // heartbeat
    setInterval(() => {
        send("heartbeat");
    }, 30000);

    // session end
    window.addEventListener("beforeunload", () => {
        send("page_exit");
    });

})();
