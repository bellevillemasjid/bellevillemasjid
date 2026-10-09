(function () {
  "use strict";

  // Belleville, Ontario — Islamic Society of Belleville
  const LAT = 44.1628;
  const LNG = -77.3833;
  const TZ = "America/Toronto";
  const EMAIL = "masjidbelleville@gmail.com";

  /* ---------- Prayer times (ISNA method, based on solar position) ---------- */
  const RAD = Math.PI / 180;
  const OBLIQUITY = RAD * 23.4397;

  function toDays(date) {
    return date.getTime() / 86400000 - 0.5 + 2440588 - 2451545;
  }

  function fromJulian(j) {
    return new Date((j + 0.5 - 2440588) * 86400000);
  }

  function solarMeanAnomaly(d) {
    return RAD * (357.5291 + 0.98560028 * d);
  }

  function eclipticLongitude(m) {
    const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
    return m + c + RAD * 102.9372 + Math.PI;
  }

  function declination(l) {
    return Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  }

  function hourAngle(h, phi, dec) {
    const value = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    return Math.acos(Math.min(1, Math.max(-1, value)));
  }

  function julianCycle(d, lw) {
    return Math.round(d - 0.0009 - lw / (2 * Math.PI));
  }

  function approxTransit(ht, lw, n) {
    return 0.0009 + (ht + lw) / (2 * Math.PI) + n;
  }

  function solarTransitJ(ds, m, l) {
    return 2451545 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  }

  function getSetJ(h, phi, dec, lw, n, m, l) {
    const w = hourAngle(h, phi, dec);
    return solarTransitJ(approxTransit(w, lw, n), m, l);
  }

  function arccot(x) {
    return Math.PI / 2 - Math.atan(x);
  }

  function calcPrayerTimes(date) {
    const lw = RAD * -LNG;
    const phi = RAD * LAT;
    const d = toDays(date);
    const n = julianCycle(d, lw);
    const ds = approxTransit(0, lw, n);
    const m = solarMeanAnomaly(ds);
    const l = eclipticLongitude(m);
    const dec = declination(l);
    const jNoon = solarTransitJ(ds, m, l);

    const noon = fromJulian(jNoon);

    const jSunset = getSetJ(-0.833 * RAD, phi, dec, lw, n, m, l);
    const jSunrise = jNoon - (jSunset - jNoon);

    const jIsha = getSetJ(-15 * RAD, phi, dec, lw, n, m, l);
    const jFajr = jNoon - (jIsha - jNoon);

    const asrAltitude = arccot(Math.tan(Math.abs(phi - dec)) + 1);
    const jAsr = getSetJ(asrAltitude, phi, dec, lw, n, m, l);

    return {
      Fajr: fromJulian(jFajr),
      Sunrise: fromJulian(jSunrise),
      Dhuhr: noon,
      Asr: fromJulian(jAsr),
      Maghrib: fromJulian(jSunset),
      Isha: fromJulian(jIsha),
    };
  }

  /* ---------- Formatting (in the masjid's timezone) ---------- */
  function formatTimeParts(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type).value;
    return { time: get("hour") + ":" + get("minute"), period: get("dayPeriod") };
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  /* ---------- Prayer times widget ---------- */
  const PRAYER_NAMES = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const ACTUAL_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  let displayDate = new Date();

  function renderPrayerTimes() {
    const times = calcPrayerTimes(displayDate);
    const grid = document.getElementById("prayer-grid");
    const dateLabel = document.getElementById("prayer-date");

    dateLabel.textContent = formatDateLong(displayDate);
    grid.setAttribute("aria-busy", "false");

    const now = new Date();
    const upcoming = ACTUAL_PRAYERS
      .map((name) => times[name])
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];

    PRAYER_NAMES.forEach((name) => {
      const card = grid.querySelector('[data-prayer="' + name + '"]');
      if (!card) return;
      const timeEl = card.querySelector(".prayer-time");
      const time = times[name];

      timeEl.classList.remove("skeleton");
      timeEl.innerHTML = "";
      const parts = formatTimeParts(time);
      timeEl.appendChild(document.createTextNode(parts.time + " "));
      const period = document.createElement("span");
      period.textContent = parts.period;
      timeEl.appendChild(period);

      card.classList.toggle("next-prayer", ACTUAL_PRAYERS.includes(name) && time.getTime() === (upcoming && upcoming.getTime()));
    });
  }

  document.getElementById("prev-day").addEventListener("click", function () {
    displayDate.setDate(displayDate.getDate() - 1);
    renderPrayerTimes();
  });

  document.getElementById("next-day").addEventListener("click", function () {
    displayDate.setDate(displayDate.getDate() + 1);
    renderPrayerTimes();
  });

  /* ---------- Mobile navigation ---------- */
  const menuToggle = document.getElementById("menu-toggle");
  const mainNav = document.getElementById("main-nav");

  menuToggle.addEventListener("click", function () {
    const open = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  mainNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      mainNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- Scroll spy ---------- */
  const sections = ["prayer-times", "about", "programs", "islamic-calendar", "community", "contact"];
  const navLinks = mainNav.querySelectorAll("a");

  function updateActiveLink() {
    let currentId = "prayer-times";
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 160) {
        currentId = id;
      }
    }
    navLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + currentId);
    });
  }

  window.addEventListener("scroll", updateActiveLink, { passive: true });
  updateActiveLink();

  /* ---------- Dialog ---------- */
  const dialog = document.getElementById("site-dialog");
  const dialogContent = document.getElementById("dialog-content");

  const DIALOGS = {
    donate: function () {
      return (
        '<div class="eyebrow">GIVE WITH PURPOSE</div>' +
        "<h2>Support your masjid</h2>" +
        "<p>Thank you for considering a donation. Your generosity helps keep our doors open, supports Islamic education, and brings care to those who need it.</p>" +
        '<div class="donation-instructions"><strong>Give securely through Interac e-Transfer</strong>' +
        "<p>Send your donation to the address below. Use the security answer you feel is appropriate, and add a note such as &ldquo;General donation&rdquo;, &ldquo;Zakat&rdquo; or &ldquo;Fitrana&rdquo;.</p></div>" +
        '<span class="field-label">Interac e-Transfer recipient</span>' +
        '<div class="copy-email"><span>' + EMAIL + "</span><button type=\"button\" id=\"copy-email\" aria-label=\"Copy email address\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"9\" y=\"9\" width=\"11\" height=\"11\" rx=\"2\"/><path d=\"M5 15V5a2 2 0 0 1 2-2h10\"/></svg></button></div>" +
        '<span class="copy-status" id="copy-status" role="status"></span>' +
        '<p class="small-text" style="margin-top:22px">Please note: PayPal is no longer accepted. Cash donations are also welcome at the masjid.</p>'
      );
    },
    "event-eid": function () {
      return (
        '<div class="eyebrow">COMMUNITY MOMENTS</div>' +
        "<h2>Celebrating Eid, together.</h2>" +
        "<p>Eid al-Adha prayer was held at Belleville Masjid with takbeer at 8:00 AM and salat at 8:30 AM. It was a shared morning of prayer, gratitude, and connection.</p>" +
        '<p style="margin-top:14px">For the latest Eid and Jumu&lsquo;ah arrangements, please check our community Facebook page or contact the masjid directly.</p>' +
        '<a class="button" href="https://www.facebook.com/bellevillemasjid" target="_blank" rel="noreferrer">Follow our community</a>'
      );
    },
    "event-neighbours": function () {
      return (
        '<div class="eyebrow">A FRIENDLY REMINDER</div>' +
        "<h2>Good neighbours. A caring community.</h2>" +
        "<p>To maintain safe and orderly proceedings of masjid prayers, all members are kindly requested to follow these guidelines:</p>" +
        '<div class="donation-instructions">' +
        "<p>1. When exiting the masjid, especially after Friday prayer, please consider making a <strong>right turn</strong> on Moira Street instead of a left, and take a U-turn when possible.</p>" +
        "<p>2. Please avoid jay-walking in front of the masjid during busy hours.</p>" +
        "<p>3. Please do not park in designated parking spots or where parking is prohibited.</p></div>" +
        "<p class=\"small-text\">This ensures safe and efficient use of the masjid facility without causing inconvenience to our neighbours. Jazakallah.</p>"
      );
    },
  };

  const PROGRAM_DIALOGS = {
    children: {
      title: "Children&rsquo;s Qur&rsquo;an learning",
      text: "A gentle introduction to the Qur&rsquo;an for our youngest community members. Through patient, one-on-one guidance, children build a foundation of faith and the confidence to recite with care.",
    },
    sisters: {
      title: "Sisters&rsquo; Qur&rsquo;an circle",
      text: "A welcoming space for sisters to learn, reflect, and connect. Gather with fellow sisters to study the Qur&rsquo;an in good company and grow together in faith.",
    },
    prayer: {
      title: "Prayer &amp; spiritual connection",
      text: "The heart of our faith. Join us for the five daily prayers, Friday Jumu&lsquo;ah, and moments of quiet reflection that anchor the week.",
    },
    giving: {
      title: "Giving &amp; community care",
      text: "Faith through service. Small acts of kindness &mdash; from food drives to neighbourly support &mdash; create meaningful shared impact across our community.",
    },
  };

  function openDialog(html) {
    dialogContent.innerHTML = html;
    dialog.showModal();
    const copyBtn = dialogContent.querySelector("#copy-email");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const status = dialogContent.querySelector("#copy-status");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(EMAIL).then(function () {
            status.textContent = "Email address copied to clipboard.";
          });
        } else {
          status.textContent = "Copy this address: " + EMAIL;
        }
      });
    }
  }

  document.querySelectorAll("[data-dialog]").forEach(function (el) {
    el.addEventListener("click", function () {
      const key = el.getAttribute("data-dialog");
      if (DIALOGS[key]) openDialog(DIALOGS[key]());
    });
  });

  document.querySelectorAll("[data-program]").forEach(function (el) {
    el.addEventListener("click", function () {
      const key = el.getAttribute("data-program");
      const info = PROGRAM_DIALOGS[key];
      if (!info) return;
      openDialog(
        '<div class="eyebrow">OUR PROGRAMS</div>' +
          "<h2>" + info.title + "</h2>" +
          "<p>" + info.text + "</p>" +
          '<a class="button" href="mailto:' + EMAIL + '?subject=' + encodeURIComponent(info.title) + '">Ask about this program</a>'
      );
    });
  });

  document.querySelectorAll("[data-dialog-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      dialog.close();
    });
  });

  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- Init ---------- */
  renderPrayerTimes();
})();
