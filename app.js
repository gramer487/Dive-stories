(() => {
  "use strict";

  const MAX_EDGE = 2400;
  const CUSTOM_MIN = 320;
  const CUSTOM_MAX = 4096;
  const GITHUB_URL = "github.com/gramer487/Dive-stories";
  const ACCENT = "#9df0da";
  const ACCENT_BRIGHT = "#c7fff0";
  const INK = "#f2fbf8";
  const MUTED_SOFT = "rgba(224, 246, 240, 0.44)";
  const HAIRLINE = "rgba(224, 246, 240, 0.13)";

  const canvas = document.getElementById("storyCanvas");
  const ctx = canvas.getContext("2d");

  const els = {
    photoDrop: document.getElementById("photoDrop"),
    photoInput: document.getElementById("photoInput"),
    photoThumb: document.getElementById("photoThumb"),
    photoMeta: document.getElementById("photoMeta"),
    diveDrop: document.getElementById("diveDrop"),
    diveInput: document.getElementById("diveInput"),
    diveMeta: document.getElementById("diveMeta"),
    fileError: document.getElementById("fileError"),
    sourceChips: document.getElementById("sourceChips"),
    siteInput: document.getElementById("siteInput"),
    dateInput: document.getElementById("dateInput"),
    configInput: document.getElementById("configInput"),
    suitInput: document.getElementById("suitInput"),
    diveNumberReadout: document.getElementById("diveNumberReadout"),
    storyStatus: document.getElementById("storyStatus"),
    tankList: document.getElementById("tankList"),
    addTankBtn: document.getElementById("addTankBtn"),
    sacOutput: document.getElementById("sacOutput"),
    sacNote: document.getElementById("sacNote"),
    stageSubtitle: document.getElementById("stageSubtitle"),
    canvasInfo: document.getElementById("canvasInfo"),
    canvasFrame: document.getElementById("canvasFrame"),
    emptyState: document.getElementById("emptyState"),
    emptyPhotoBtn: document.getElementById("emptyPhotoBtn"),
    downloadBtn: document.getElementById("downloadBtn"),
    ratioButtons: Array.from(document.querySelectorAll("[data-ratio]")),
    customSize: document.getElementById("customSize"),
    customWidth: document.getElementById("customWidth"),
    customHeight: document.getElementById("customHeight"),
  };

  const state = {
    photo: null,
    photoUrl: "",
    photoName: "",
    dive: null,
    diveName: "",
    site: "",
    date: "",
    configuration: "",
    exposureSuit: "",
    units: "metric",
    tanks: [],
    ratio: "portrait",
    customWidth: 1920,
    customHeight: 2400,
    tankId: 0,
    renderQueued: false,
    savedTimer: null,
  };

  init();

  function init() {
    bindEvents();
    addTank(false);
    updateStageSubtitle();
    updateGasUI();
    updateCustomSizeVisibility();
    updateOutputInfo();
    scheduleRender();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleRender).catch(() => {});
    }

    window.addEventListener("resize", scheduleRender, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    wireDropzone(els.photoDrop, els.photoInput, handlePhotoFile);
    wireDropzone(els.diveDrop, els.diveInput, handleDiveFile);
    els.photoInput.addEventListener("click", (event) => event.stopPropagation());
    els.diveInput.addEventListener("click", (event) => event.stopPropagation());

    els.emptyPhotoBtn.addEventListener("click", () => els.photoInput.click());

    els.siteInput.addEventListener("input", () => {
      state.site = els.siteInput.value;
      scheduleRender();
    });

    els.dateInput.addEventListener("input", () => {
      state.date = els.dateInput.value;
      scheduleRender();
    });

    els.configInput.addEventListener("change", () => {
      state.configuration = els.configInput.value;
      scheduleRender();
    });

    els.suitInput.addEventListener("change", () => {
      state.exposureSuit = els.suitInput.value;
      scheduleRender();
    });

    els.ratioButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.ratio = button.dataset.ratio;
        els.ratioButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        updateCustomSizeVisibility();
        updateOutputInfo();
        scheduleRender();
      });
    });

    els.customWidth.addEventListener("input", () => {
      const value = parseCustomDimension(els.customWidth.value);
      if (value !== null) {
        state.customWidth = value;
        updateOutputInfo();
        scheduleRender();
      }
    });

    els.customHeight.addEventListener("input", () => {
      const value = parseCustomDimension(els.customHeight.value);
      if (value !== null) {
        state.customHeight = value;
        updateOutputInfo();
        scheduleRender();
      }
    });

    els.customWidth.addEventListener("change", () => normalizeCustomInput(els.customWidth, "customWidth"));
    els.customHeight.addEventListener("change", () => normalizeCustomInput(els.customHeight, "customHeight"));

    document.addEventListener("paste", handlePaste);

    els.addTankBtn.addEventListener("click", () => addTank(true));

    els.tankList.addEventListener("input", (event) => {
      const input = event.target.closest("[data-tank-field]");
      if (!input) return;
      const card = input.closest("[data-tank-id]");
      const tank = state.tanks.find((item) => String(item.id) === card.dataset.tankId);
      if (!tank) return;
      tank[input.dataset.tankField] = input.value;
      updateGasUI();
      scheduleRender();
    });

    els.tankList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-tank]");
      if (!button) return;
      const card = button.closest("[data-tank-id]");
      state.tanks = state.tanks.filter((item) => String(item.id) !== card.dataset.tankId);
      if (!state.tanks.length) addTank(false);
      rebuildTankList();
      updateGasUI();
      scheduleRender();
    });

    els.downloadBtn.addEventListener("click", downloadStory);

    window.addEventListener("dragover", (event) => {
      if (!event.target.closest(".dropzone")) event.preventDefault();
    });
    window.addEventListener("drop", (event) => {
      if (!event.target.closest(".dropzone")) event.preventDefault();
    });
  }

  function wireDropzone(zone, input, handler) {
    const open = () => input.click();

    zone.addEventListener("click", open);
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) handler(file);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.add("is-dragging");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (!zone.contains(event.relatedTarget)) zone.classList.remove("is-dragging");
      });
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("is-dragging");
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handler(file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Photo                                                               */
  /* ------------------------------------------------------------------ */

  function handlePhotoFile(file, displayName) {
    if (!file.type.startsWith("image/")) {
      showFileError("That doesn’t look like an image. Choose a JPG, PNG or WebP.");
      return;
    }

    clearFileError();
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const name = displayName || file.name || "Dive photo";

    image.onload = () => {
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      state.photo = image;
      state.photoUrl = objectUrl;
      state.photoName = name;

      els.photoDrop.classList.add("is-loaded");
      els.photoThumb.style.backgroundImage = `url("${objectUrl}")`;
      els.photoMeta.textContent = `${name} · ${image.naturalWidth} × ${image.naturalHeight}`;
      els.emptyState.classList.add("is-hidden");

      updateStageSubtitle();
      updateDownloadState();
      updateOutputInfo();
      scheduleRender();
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showFileError("That image couldn’t be read. Try exporting it again, or choose another photo.");
    };

    image.src = objectUrl;
  }

  function handlePaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const items = Array.from(clipboard.items || []);
    const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
    const file = imageItem ? imageItem.getAsFile() : null;
    if (!file) return;

    event.preventDefault();
    handlePhotoFile(file, "Pasted image");
  }

  /* ------------------------------------------------------------------ */
  /* Shearwater CSV                                                      */
  /* ------------------------------------------------------------------ */

  function handleDiveFile(file) {
    file
      .text()
      .then((text) => {
        const dive = parseShearwaterCsv(text);
        clearFileError();
        state.dive = dive;
        state.diveName = file.name;
        state.units = dive.units;
        state.date = dive.dateISO || state.date;
        els.dateInput.value = state.date;

        resetTanksFromDive(dive);
        rebuildTankList();
        updateGasUI();

        els.diveDrop.classList.add("is-loaded");
        els.diveMeta.textContent = [
          dive.model || "Shearwater log",
          formatDuration(dive.durationSec),
          `${formatDistance(dive.maxDepthM, dive.units)} ${unitForDepth(dive.units)}`,
        ].join(" · ");

        renderSourceChips(dive);
        updateStageSubtitle();
        updateDownloadState();
        updateOutputInfo();
        els.diveNumberReadout.textContent = dive.number ? `#${dive.number}` : "—";
        els.diveNumberReadout.classList.toggle("is-ready", Boolean(dive.number));
        els.storyStatus.textContent = dive.hasDeco ? "Technical dive loaded" : "Log loaded";
        els.storyStatus.classList.add("is-ready");

        scheduleRender();
      })
      .catch((error) => {
        showFileError(
          error && error.message
            ? error.message
            : "That file couldn’t be read. Export a single dive from Shearwater Cloud as CSV and try again."
        );
      });
  }

  function parseShearwaterCsv(text) {
    const rows = parseCsvRows(text.replace(/^﻿/, "")).filter((row) =>
      row.some((cell) => cell.trim() !== "")
    );

    if (rows.length < 3) {
      throw new Error("This CSV doesn’t contain any dive samples. Export one dive from Shearwater Cloud and try again.");
    }

    const sampleHeaderIndex = rows.findIndex((row) => {
      const cells = row.map((cell) => cell.trim().toLowerCase());
      return cells.includes("depth") && cells.some((cell) => cell.startsWith("time"));
    });

    if (sampleHeaderIndex < 1) {
      throw new Error("That doesn’t look like a Shearwater Cloud CSV. Use File → Export → CSV on a single dive, then try again.");
    }

    let summaryHeaderIndex = -1;
    for (let index = sampleHeaderIndex - 1; index >= 0; index -= 1) {
      const cells = rows[index].map((cell) => cell.trim().toLowerCase());
      if (cells.includes("dive number") || cells.includes("max depth")) {
        summaryHeaderIndex = index;
        break;
      }
    }

    if (summaryHeaderIndex < 0 || summaryHeaderIndex + 1 >= sampleHeaderIndex) {
      throw new Error("The dive summary is missing from this CSV. Re-export the dive from Shearwater Cloud.");
    }

    const summaryHeader = rows[summaryHeaderIndex].map(cleanHeader);
    const summaryRow = rows[summaryHeaderIndex + 1];
    const summary = {};
    summaryHeader.forEach((header, index) => {
      if (header) summary[header.toLowerCase()] = (summaryRow[index] || "").trim();
    });

    const sampleHeader = rows[sampleHeaderIndex].map(cleanHeader);
    const sampleRows = rows.slice(sampleHeaderIndex + 1);
    const lookup = (...names) => {
      const wanted = names.map((name) => name.toLowerCase());
      return sampleHeader.findIndex((header) => wanted.includes(header.toLowerCase()));
    };
    const lookupPattern = (pattern) => sampleHeader.findIndex((header) => pattern.test(header));

    const timeIndex = lookup("Time (sec)", "Time", "Elapsed Time (sec)");
    const depthIndex = lookup("Depth");

    if (timeIndex < 0 || depthIndex < 0) {
      throw new Error("This CSV doesn’t include a time/depth profile. Re-export it from Shearwater Cloud.");
    }

    const tempIndex = lookupPattern(/^water temp/i);
    const ttsIndex = lookupPattern(/^time to surface/i);
    const ceilingIndex = lookupPattern(/^(first stop depth|deco ceiling)/i);
    const firstStopTimeIndex = lookupPattern(/^first stop time/i);
    const ndlIndex = lookupPattern(/^current ndl/i);
    const o2Index = lookupPattern(/^fraction o2/i);
    const heIndex = lookupPattern(/^fraction he/i);

    const pressureColumns = [];
    sampleHeader.forEach((header, index) => {
      const match = header.match(/^tank\s*(\d+)\s*pressure(?:\s*\(([^)]+)\))?/i);
      if (match) {
        pressureColumns.push({
          index,
          tank: Number(match[1]),
          unit: (match[2] || "").trim().toLowerCase(),
        });
      }
    });

    const imperial = isTruthy(summary["imperial units"]) ||
      /\b(ft|feet)\b/i.test(summary["max depth unit"] || "");
    const units = imperial ? "imperial" : "metric";

    const samples = [];
    for (const row of sampleRows) {
      const time = toNumber(row[timeIndex]);
      const rawDepth = toNumber(row[depthIndex]);
      if (time === null || rawDepth === null) continue;

      const sample = {
        t: time,
        depthM: imperial ? rawDepth * 0.3048 : rawDepth,
        tempC: null,
        ttsMin: ttsIndex >= 0 ? toNumber(row[ttsIndex]) : null,
        ceilingM: 0,
        firstStopMin: firstStopTimeIndex >= 0 ? toNumber(row[firstStopTimeIndex]) : null,
        ndlMin: ndlIndex >= 0 ? toNumber(row[ndlIndex]) : null,
        o2: o2Index >= 0 ? normalizeFraction(toNumber(row[o2Index])) : null,
        he: heIndex >= 0 ? normalizeFraction(toNumber(row[heIndex])) : null,
        pressuresBar: [],
      };

      if (tempIndex >= 0) {
        const rawTemp = toNumber(row[tempIndex]);
        if (rawTemp !== null) {
          sample.tempC = imperial ? ((rawTemp - 32) * 5) / 9 : rawTemp;
        }
      }

      if (ceilingIndex >= 0) {
        const rawCeiling = toNumber(row[ceilingIndex]);
        if (rawCeiling !== null) {
          sample.ceilingM = imperial ? rawCeiling * 0.3048 : rawCeiling;
        }
      }

      for (const column of pressureColumns) {
        const rawPressure = toNumber(row[column.index]);
        const pressureBar = rawPressure === null
          ? null
          : column.unit === "psi" || (!column.unit && imperial)
            ? rawPressure * 0.0689475729
            : rawPressure;
        sample.pressuresBar.push(pressureBar);
      }

      samples.push(sample);
    }

    samples.sort((a, b) => a.t - b.t);
    if (samples.length < 2) {
      throw new Error("No usable profile samples were found in this CSV.");
    }

    const summaryMaxTime = toNumber(summary["max time"]);
    const durationSec = Math.max(
      1,
      summaryMaxTime !== null && summaryMaxTime > 0 ? summaryMaxTime : samples[samples.length - 1].t
    );

    const sampleMaxDepth = samples.reduce((max, sample) => Math.max(max, sample.depthM), 0);
    const summaryMaxDepthRaw = toNumber(summary["max depth"]);
    const summaryMaxDepthM = summaryMaxDepthRaw === null
      ? null
      : imperial
        ? summaryMaxDepthRaw * 0.3048
        : summaryMaxDepthRaw;
    const maxDepthM = Math.max(sampleMaxDepth, summaryMaxDepthM || 0);

    const avgDepthM = timeWeightedAverage(samples, (sample) => sample.depthM, durationSec);
    const avgTempC = timeWeightedAverage(samples, (sample) => sample.tempC, durationSec);

    const peakSample = samples.reduce(
      (best, sample) => (sample.depthM > best.depthM ? sample : best),
      samples[0]
    );
    const bottomGas = gasFromSample(peakSample) ||
      samples.map(gasFromSample).find(Boolean) ||
      null;

    const gasList = [];
    for (const sample of samples) {
      const gas = gasFromSample(sample);
      if (!gas) continue;
      const label = formatGas(gas.o2, gas.he);
      if (!gasList.some((entry) => entry.label === label)) gasList.push({ ...gas, label });
    }
    if (bottomGas) {
      const bottomLabel = formatGas(bottomGas.o2, bottomGas.he);
      const index = gasList.findIndex((entry) => entry.label === bottomLabel);
      if (index > 0) gasList.unshift(gasList.splice(index, 1)[0]);
    }

    const hasDeco = samples.some((sample) => sample.ceilingM > 0.05);
    let decoTtsMin = null;
    if (hasDeco) {
      decoTtsMin = samples.reduce(
        (max, sample) => Math.max(max, sample.ttsMin || 0),
        0
      );
    }

    const gfMin = toNumber(summary["gf minimum"]);
    const gfMax = toNumber(summary["gf maximum"]);
    const decoModel = (summary["deco model"] || "").trim();
    const vpmConservatism = (summary["vpm-b conservatism"] || "").trim();

    let conservatism = null;
    if (gfMin !== null && gfMax !== null) {
      conservatism = `GF ${round(gfMin)}/${round(gfMax)}`;
    } else if (decoModel) {
      if (/vpm/i.test(decoModel)) {
        const level = vpmConservatism && !vpmConservatism.includes("/")
          ? ` +${vpmConservatism}`
          : "";
        conservatism = `VPM-B${level}`;
      } else {
        conservatism = decoModel;
      }
    }

    const aiTanks = pressureColumns
      .map((column) => {
        const values = samples
          .map((sample) => sample.pressuresBar[pressureColumns.indexOf(column)])
          .filter((value) => value !== null);
        if (!values.length) return null;
        return {
          tank: column.tank,
          startBar: values[0],
          endBar: values[values.length - 1],
        };
      })
      .filter(Boolean);

    return {
      units,
      imperial,
      number: (summary["dive number"] || "").trim(),
      model: (summary["product"] || summary["computer model"] || "").trim(),
      serial: (summary["computer serial number"] || "").trim(),
      dateISO: parseShearwaterDate(summary["start date"]),
      durationSec,
      maxDepthM,
      avgDepthM,
      avgTempC,
      samples,
      bottomGas,
      gasList,
      divesGasLabels: gasList.map((gas) => gas.label),
      endCns: toNumber(summary["end cns"]),
      startCns: toNumber(summary["start cns %"]),
      gfMin,
      gfMax,
      decoModel,
      conservatism,
      hasDeco,
      decoTtsMin,
      aiTanks,
      sampleCount: samples.length,
      endedAt: summary["end date"] || "",
    };
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inQuotes) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function cleanHeader(value) {
    return String(value || "").replace(/^﻿/, "").trim();
  }

  function normalizeFraction(value) {
    if (value === null || !Number.isFinite(value)) return null;
    return value > 1.5 ? value / 100 : value;
  }

  function gasFromSample(sample) {
    if (!sample || sample.o2 === null || !Number.isFinite(sample.o2)) return null;
    return {
      o2: sample.o2,
      he: Number.isFinite(sample.he) ? sample.he : 0,
    };
  }

  function formatGas(o2Fraction, heFraction) {
    const o2 = Math.round(o2Fraction * 100);
    const he = Math.round((heFraction || 0) * 100);
    if (he > 0) return `Tx ${o2}/${he}`;
    if (o2 >= 20 && o2 <= 22) return "Air";
    if (o2 === 100) return "O₂";
    return `Nx${o2}`;
  }

  function parseShearwaterDate(raw) {
    if (!raw) return "";
    let match = String(raw).trim().match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
    );

    if (match) {
      let month = Number(match[1]);
      let day = Number(match[2]);
      const year = Number(match[3]);
      if (month > 12 && day <= 12) {
        const swap = month;
        month = day;
        day = swap;
      }
      if (validDate(year, month, day)) return isoFromParts(year, month, day);
    }

    match = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (validDate(year, month, day)) return isoFromParts(year, month, day);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return isoFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
    return "";
  }

  function validDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function isoFromParts(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function timeWeightedAverage(samples, valueGetter, durationSec) {
    const points = [];
    for (const sample of samples) {
      const value = valueGetter(sample);
      if (Number.isFinite(value)) points.push({ t: sample.t, value });
    }
    if (!points.length) return null;

    points.sort((a, b) => a.t - b.t);
    if (points[0].t > 0) points.unshift({ t: 0, value: points[0].value });
    if (points[points.length - 1].t < durationSec) {
      points.push({ t: durationSec, value: points[points.length - 1].value });
    }

    let integral = 0;
    let covered = 0;

    for (let index = 1; index < points.length; index += 1) {
      const start = Math.max(0, points[index - 1].t);
      const end = Math.min(durationSec, points[index].t);
      if (end <= start) continue;

      const from = points[index - 1];
      const to = points[index];
      const span = to.t - from.t || 1;
      const valueAtStart = from.value + ((to.value - from.value) * (start - from.t)) / span;
      const valueAtEnd = from.value + ((to.value - from.value) * (end - from.t)) / span;
      integral += ((valueAtStart + valueAtEnd) / 2) * (end - start);
      covered += end - start;
    }

    if (covered <= 0) return null;
    return integral / Math.min(durationSec, covered);
  }

  /* ------------------------------------------------------------------ */
  /* Tanks & SAC                                                         */
  /* ------------------------------------------------------------------ */

  function addTank(focus) {
    const tank = {
      id: ++state.tankId,
      volume: "",
      start: "",
      end: "",
      rated: "",
    };
    state.tanks.push(tank);
    rebuildTankList();

    if (focus) {
      const selector = `[data-tank-id="${tank.id}"] input[data-tank-field="volume"]`;
      const input = els.tankList.querySelector(selector);
      if (input) input.focus();
    }
  }

  function resetTanksFromDive(dive) {
    state.tanks = [];
    state.tankId = 0;

    if (dive.aiTanks && dive.aiTanks.length) {
      dive.aiTanks.forEach((aiTank) => {
        state.tanks.push({
          id: ++state.tankId,
          volume: "",
          start: formatInputNumber(dive.units === "imperial" ? aiTank.startBar / 0.0689475729 : aiTank.startBar),
          end: formatInputNumber(dive.units === "imperial" ? aiTank.endBar / 0.0689475729 : aiTank.endBar),
          rated: "",
        });
      });
    } else {
      addTank(false);
    }
  }

  function rebuildTankList() {
    const units = state.dive ? state.dive.units : "metric";
    const imperial = units === "imperial";
    els.tankList.textContent = "";

    state.tanks.forEach((tank, index) => {
      const card = document.createElement("div");
      card.className = "tank-card";
      card.dataset.tankId = String(tank.id);

      const head = document.createElement("div");
      head.className = "tank-head";

      const name = document.createElement("span");
      name.className = "tank-name";
      name.textContent = state.tanks.length === 1 ? "Single tank" : `Tank ${index + 1}`;
      head.appendChild(name);

      if (state.tanks.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tank-remove";
        remove.dataset.removeTank = "true";
        remove.textContent = "Remove";
        head.appendChild(remove);
      }

      card.appendChild(head);

      const fields = document.createElement("div");
      fields.className = `tank-fields${imperial ? " is-imperial" : ""}`;
      const fieldDefs = [
        {
          key: "volume",
          label: imperial ? "Tank size" : "Tank volume",
          unit: imperial ? "cu ft" : "L",
          placeholder: imperial ? "80" : "12",
          step: imperial ? "1" : "0.1",
        },
        {
          key: "start",
          label: "Start",
          unit: imperial ? "psi" : "bar",
          placeholder: imperial ? "3000" : "200",
          step: "1",
        },
        {
          key: "end",
          label: "End",
          unit: imperial ? "psi" : "bar",
          placeholder: imperial ? "700" : "60",
          step: "1",
        },
      ];

      if (imperial) {
        fieldDefs.push({
          key: "rated",
          label: "Rated",
          unit: "psi",
          placeholder: "3000",
          step: "1",
        });
      }

      fieldDefs.forEach((definition) => {
        const label = document.createElement("label");
        label.className = "tank-field";

        const caption = document.createElement("span");
        caption.innerHTML = `${definition.label} <em>${definition.unit}</em>`;

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = definition.step;
        input.inputMode = "decimal";
        input.placeholder = definition.placeholder;
        input.value = tank[definition.key] || "";
        input.dataset.tankField = definition.key;
        input.setAttribute(
          "aria-label",
          `${definition.label} in ${definition.unit}, ${state.tanks.length === 1 ? "single tank" : `tank ${index + 1}`}`
        );

        label.append(caption, input);
        fields.appendChild(label);
      });

      const used = document.createElement("p");
      used.className = "tank-used";
      used.dataset.tankUsed = String(tank.id);
      used.textContent = imperial
        ? "Add size, start, end and rated pressure"
        : "Add volume, start and end pressure";

      card.append(fields, used);
      els.tankList.appendChild(card);
    });

    els.addTankBtn.hidden = false;
    updateGasUI();
  }

  function tankValues(tank) {
    return {
      volume: toNumber(tank.volume),
      start: toNumber(tank.start),
      end: toNumber(tank.end),
      rated: toNumber(tank.rated),
    };
  }

  function tankIsTouched(tank) {
    return ["volume", "start", "end", "rated"].some((key) => String(tank[key] || "").trim() !== "");
  }

  function tankResult(tank, units) {
    const values = tankValues(tank);
    const imperial = units === "imperial";
    if (!tankIsTouched(tank)) return { status: "empty" };

    if (values.volume === null || values.start === null || values.end === null) {
      return { status: "incomplete" };
    }
    if (values.volume <= 0 || values.start < 0 || values.end < 0 || values.end > values.start) {
      return { status: "invalid" };
    }

    if (imperial) {
      if (values.rated === null || values.rated <= 0) return { status: "incomplete" };
      const cubicFeet = (values.volume * (values.start - values.end)) / values.rated;
      return { status: "ready", usedLiters: cubicFeet * 28.3168466, usedImperial: cubicFeet };
    }

    return {
      status: "ready",
      usedLiters: values.volume * (values.start - values.end),
      usedImperial: (values.volume * (values.start - values.end)) / 28.3168466,
    };
  }

  function calculateSac() {
    if (!state.dive) return null;
    const units = state.dive.units;
    const imperial = units === "imperial";
    const results = state.tanks.map((tank) => ({ tank, result: tankResult(tank, units) }));
    const touched = results.filter((entry) => entry.result.status !== "empty");
    if (!touched.length) return null;

    const incomplete = touched.some((entry) => entry.result.status !== "ready");
    const ready = touched.filter((entry) => entry.result.status === "ready");
    const usedLiters = ready.reduce((total, entry) => total + entry.result.usedLiters, 0);

    if (incomplete || !ready.length) {
      return {
        sac: null,
        incomplete: true,
        usedLiters,
        usedImperial: usedLiters / 28.3168466,
        units,
        entries: results,
      };
    }

    const durationMin = state.dive.durationSec / 60;
    const averageAmbient = 1 + state.dive.avgDepthM / 10;
    const sacLiters = usedLiters / (durationMin * averageAmbient);

    return {
      sac: imperial ? sacLiters / 28.3168466 : sacLiters,
      sacLiters,
      incomplete: false,
      usedLiters,
      usedImperial: usedLiters / 28.3168466,
      units,
      entries: results,
    };
  }

  function updateGasUI() {
    const sacInfo = calculateSac();
    const units = state.dive ? state.dive.units : "metric";
    const imperial = units === "imperial";

    if (sacInfo && sacInfo.sac !== null) {
      const value = imperial ? sacInfo.sac.toFixed(2) : sacInfo.sac.toFixed(1);
      els.sacOutput.textContent = `${value} ${imperial ? "cu ft/min" : "L/min"}`;
      els.sacOutput.classList.add("is-ready");
    } else if (sacInfo && sacInfo.incomplete) {
      els.sacOutput.textContent = "Incomplete";
      els.sacOutput.classList.remove("is-ready");
    } else {
      els.sacOutput.textContent = "—";
      els.sacOutput.classList.remove("is-ready");
    }

    state.tanks.forEach((tank) => {
      const result = tankResult(tank, units);
      const element = els.tankList.querySelector(`[data-tank-used="${tank.id}"]`);
      if (!element) return;

      element.classList.toggle("is-ready", result.status === "ready");
      if (result.status === "ready") {
        element.textContent = imperial
          ? `${formatNumber(result.usedImperial, 1)} cu ft used`
          : `${formatNumber(result.usedLiters, 0)} L used`;
      } else if (result.status === "invalid") {
        element.textContent = "Check the pressures — end must be below start";
      } else if (result.status === "incomplete") {
        element.textContent = imperial
          ? "Add size, start, end and rated pressure"
          : "Add volume, start and end pressure";
      } else {
        element.textContent = imperial
          ? "Add size, start, end and rated pressure"
          : "Add volume, start and end pressure";
      }
    });

    if (!state.dive || !sacInfo) {
      els.sacNote.hidden = true;
      return;
    }

    els.sacNote.hidden = false;
    if (sacInfo.incomplete || sacInfo.sac === null) {
      els.sacNote.textContent = "Complete every active tank to calculate your surface air consumption.";
      return;
    }

    const used = imperial
      ? `${formatNumber(sacInfo.usedImperial, 1)} cu ft`
      : `${formatNumber(sacInfo.usedLiters, 0)} L`;
    const avgDepth = `${formatDistance(state.dive.avgDepthM, units)} ${unitForDepth(units)}`;
    els.sacNote.textContent = `Based on ${used} used and an average depth of ${avgDepth}.`;
  }

  function formatInputNumber(value) {
    if (!Number.isFinite(value)) return "";
    return String(Math.round(value));
  }

  /* ------------------------------------------------------------------ */
  /* Story data                                                          */
  /* ------------------------------------------------------------------ */

  function buildStory() {
    if (!state.dive) return null;

    const dive = state.dive;
    const units = dive.units;
    const depthUnit = unitForDepth(units);
    const sacInfo = calculateSac();

    const maxDepth = formatDistance(dive.maxDepthM, units);
    const avgDepth = dive.avgDepthM === null ? null : formatDistance(dive.avgDepthM, units);
    const temperature = dive.avgTempC === null ? null : formatTemperature(dive.avgTempC, units);
    const gasLabels = dive.gasList.map((gas) => gas.label);
    const gasLabel = gasLabels.length ? gasLabels.join(" / ") : null;

    const endDepthM = dive.maxDepthM !== null && dive.bottomGas
      ? equivalentNarcoticDepth(dive.maxDepthM, dive.bottomGas)
      : null;
    const endDepth = endDepthM === null ? null : formatDistance(endDepthM, units);

    const dateLabel = formatDateLabel(state.date);
    const title = state.site.trim() || (dive.number ? `Dive ${dive.number}` : "Untitled dive");

    const metaParts = [];
    if (dive.number) metaParts.push(`DIVE ${dive.number}`);
    if (dive.model) metaParts.push(dive.model.toUpperCase());
    if (!metaParts.length) metaParts.push("DIVE LOG");

    const metrics = [];
    if (temperature !== null) {
      metrics.push({ label: "WATER", value: temperature, unit: `°${units === "imperial" ? "F" : "C"}` });
    }
    if (gasLabel) {
      metrics.push({ label: "GAS", value: gasLabel, unit: "" });
    }
    if (sacInfo && sacInfo.sac !== null) {
      metrics.push({
        label: "SAC",
        value: units === "imperial" ? sacInfo.sac.toFixed(2) : sacInfo.sac.toFixed(1),
        unit: units === "imperial" ? "cu ft/min" : "L/min",
      });
    }
    if (dive.endCns !== null) {
      metrics.push({ label: "CNS END", value: String(round(dive.endCns)), unit: "%" });
    }
    if (endDepth !== null) {
      metrics.push({ label: "END", value: endDepth, unit: depthUnit });
    }
    if (dive.conservatism) {
      metrics.push({ label: "CONSERVATISM", value: dive.conservatism, unit: "" });
    }
    if (dive.hasDeco && dive.decoTtsMin !== null) {
      metrics.push({ label: "DECO / TTS", value: String(Math.round(dive.decoTtsMin)), unit: "min" });
    }

    const chartPoints = buildChartPoints(dive);
    const tags = [];
    if (dive.hasDeco) tags.push({ label: "TECHNICAL DIVE", accent: true });
    if (state.configuration) tags.push({ label: state.configuration.toUpperCase(), accent: false });
    if (state.exposureSuit) tags.push({ label: state.exposureSuit.toUpperCase(), accent: false });

    return {
      dive,
      units,
      depthUnit,
      title,
      metaLeft: metaParts.join(" · "),
      dateLabel,
      duration: formatDuration(dive.durationSec),
      durationLabel: formatDuration(dive.durationSec),
      maxDepth,
      maxDepthM: dive.maxDepthM,
      avgDepth,
      gasLabel,
      gasLabels,
      sac: sacInfo && sacInfo.sac !== null ? sacInfo.sac : null,
      metrics,
      tags,
      technical: dive.hasDeco,
      chartPoints,
    };
  }

  function equivalentNarcoticDepth(depthM, gas) {
    const inert = Math.max(0, 1 - (gas.o2 || 0) - (gas.he || 0));
    return Math.max(0, (depthM + 10) * inert - 10);
  }

  function buildChartPoints(dive) {
    const duration = dive.durationSec;
    const points = dive.samples
      .filter((sample) => sample.t >= 0 && sample.t <= duration)
      .map((sample) => ({ t: sample.t, depthM: sample.depthM }));

    if (!points.length) return [];
    const first = depthAtTime(dive.samples, 0);
    const last = depthAtTime(dive.samples, duration);
    const normalized = [];
    normalized.push({ t: 0, depthM: first });
    for (const point of points) {
      if (point.t > 0 && point.t < duration) normalized.push(point);
    }
    normalized.push({ t: duration, depthM: last });

    // Keep the canvas path light on very long dives while preserving shape.
    if (normalized.length > 1800) {
      const stride = Math.ceil(normalized.length / 1800);
      return normalized.filter((_, index) => index % stride === 0 || index === normalized.length - 1);
    }
    return normalized;
  }

  function depthAtTime(samples, time) {
    if (!samples.length) return 0;
    if (time <= samples[0].t) return samples[0].depthM;
    if (time >= samples[samples.length - 1].t) return samples[samples.length - 1].depthM;

    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const next = samples[index];
      if (time <= next.t) {
        const span = next.t - previous.t || 1;
        return previous.depthM + ((next.depthM - previous.depthM) * (time - previous.t)) / span;
      }
    }
    return samples[samples.length - 1].depthM;
  }

  /* ------------------------------------------------------------------ */
  /* Formatting                                                          */
  /* ------------------------------------------------------------------ */

  function unitForDepth(units) {
    return units === "imperial" ? "ft" : "m";
  }

  function formatDistance(meters, units) {
    if (!Number.isFinite(meters)) return "—";
    return units === "imperial" ? String(Math.round(meters / 0.3048)) : meters.toFixed(1);
  }

  function formatTemperature(celsius, units) {
    if (!Number.isFinite(celsius)) return "—";
    const value = units === "imperial" ? (celsius * 9) / 5 + 32 : celsius;
    return value.toFixed(1);
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function formatDateLabel(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return "";
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(date)
        .toUpperCase();
    } catch {
      return isoDate;
    }
  }

  function formatNumber(value, digits) {
    try {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch {
      return value.toFixed(digits);
    }
  }

  function round(value) {
    return Math.round(value);
  }

  function toNumber(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().replace(/,/g, "");
    if (normalized === "") return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function isTruthy(value) {
    return /^(true|1|yes)$/i.test(String(value || "").trim());
  }

  /* ------------------------------------------------------------------ */
  /* UI state                                                            */
  /* ------------------------------------------------------------------ */

  function updateStageSubtitle() {
    if (state.photo && state.dive) {
      const parts = [];
      if (state.dive.model) parts.push(state.dive.model);
      if (state.dive.number) parts.push(`#${state.dive.number}`);
      if (state.date) parts.push(formatDateLabel(state.date));
      els.stageSubtitle.textContent = parts.join(" · ") || "Story ready";
      return;
    }
    if (state.photo && !state.dive) {
      els.stageSubtitle.textContent = "Now add your Shearwater CSV";
      return;
    }
    if (!state.photo && state.dive) {
      els.stageSubtitle.textContent = "Now add the dive photo";
      return;
    }
    els.stageSubtitle.textContent = "Waiting for your photo";
  }

  function updateDownloadState() {
    els.downloadBtn.disabled = !(state.photo && state.dive);
  }

  function updateOutputInfo() {
    const size = outputSize();
    const labels = {
      original: "Original",
      portrait: "4:5",
      square: "1:1",
      landscape: "16:9",
      vertical: "9:16",
      custom: "Custom",
    };
    els.canvasFrame.style.setProperty("--canvas-aspect", String(size.w / size.h));
    els.canvasInfo.textContent = `${labels[state.ratio] || "Original"} · ${size.w} × ${size.h} px`;
  }

  function updateCustomSizeVisibility() {
    els.customSize.hidden = state.ratio !== "custom";
  }

  function parseCustomDimension(raw) {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < CUSTOM_MIN || value > CUSTOM_MAX) return null;
    return value;
  }

  function normalizeCustomInput(input, key) {
    const value = parseCustomDimension(input.value);
    if (value === null) {
      input.value = String(state[key]);
      return;
    }
    state[key] = value;
    input.value = String(value);
    updateOutputInfo();
    scheduleRender();
  }

  function renderSourceChips(dive) {
    els.sourceChips.textContent = "";
    const chips = [];
    if (dive.model) chips.push({ label: dive.model, accent: true });
    if (dive.hasDeco) chips.push({ label: "Technical dive", accent: true });
    if (dive.gasList.length) chips.push({ label: dive.gasList.map((gas) => gas.label).join(" / ") });
    if (dive.conservatism) chips.push({ label: dive.conservatism });
    chips.push({ label: `${dive.sampleCount} profile samples` });
    els.sourceChips.hidden = !chips.length;
    chips.forEach((chip) => {
      const element = document.createElement("span");
      element.className = `chip${chip.accent ? " is-accent" : ""}`;
      element.textContent = chip.label;
      els.sourceChips.appendChild(element);
    });
  }

  function showFileError(message) {
    els.fileError.textContent = message;
    els.fileError.hidden = false;
  }

  function clearFileError() {
    els.fileError.textContent = "";
    els.fileError.hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* Canvas                                                              */
  /* ------------------------------------------------------------------ */

  function outputSize() {
    if (state.ratio === "portrait") return { w: 1920, h: 2400 };
    if (state.ratio === "square") return { w: 2400, h: 2400 };
    if (state.ratio === "landscape") return { w: 2400, h: 1350 };
    if (state.ratio === "vertical") return { w: 1350, h: 2400 };
    if (state.ratio === "custom") {
      return { w: state.customWidth, h: state.customHeight };
    }

    if (!state.photo) return { w: 1920, h: 2400 };
    const width = state.photo.naturalWidth;
    const height = state.photo.naturalHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    return {
      w: Math.round(width * scale),
      h: Math.round(height * scale),
    };
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function render() {
    const { w, h } = outputSize();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (state.photo) {
      drawCoverPhoto(state.photo, w, h);
    } else {
      drawPlaceholderOcean(w, h);
    }

    const story = buildStory();
    if (story) {
      const layout = computeLayout(w, h, story);
      drawScrim(w, h, layout);
      drawStory(story, layout);
    } else {
      drawEmptyBrand(w, h);
    }

    updateOutputInfo();
  }

  function drawCoverPhoto(image, width, height) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const scale = Math.max(width / imageWidth, height / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    ctx.restore();
  }

  function drawPlaceholderOcean(width, height) {
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "#0c3237");
    base.addColorStop(0.42, "#082328");
    base.addColorStop(1, "#031013");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      width * 0.56,
      height * 0.08,
      0,
      width * 0.56,
      height * 0.08,
      Math.max(width, height) * 0.6
    );
    glow.addColorStop(0, "rgba(115, 216, 196, 0.26)");
    glow.addColorStop(0.42, "rgba(54, 139, 133, 0.1)");
    glow.addColorStop(1, "rgba(4, 15, 18, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let index = 0; index < 28; index += 1) {
      const x = width * (0.08 + 0.84 * pseudoRandom(index * 3.1));
      const y = height * (0.06 + 0.7 * pseudoRandom(index * 7.7 + 2.4));
      const radius = Math.max(1.1, height * 0.0018 * (0.6 + pseudoRandom(index * 5.2) * 3));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(195, 248, 235, ${0.035 + pseudoRandom(index * 2.9) * 0.07})`;
      ctx.lineWidth = Math.max(0.7, width * 0.0005);
      ctx.stroke();
    }
    ctx.restore();

    const bottom = ctx.createLinearGradient(0, height * 0.55, 0, height);
    bottom.addColorStop(0, "rgba(2, 10, 12, 0)");
    bottom.addColorStop(1, "rgba(2, 10, 12, 0.76)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, width, height);
  }

  function pseudoRandom(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawEmptyBrand(width, height) {
    const gradient = ctx.createLinearGradient(0, height * 0.72, 0, height);
    gradient.addColorStop(0, "rgba(2, 10, 12, 0)");
    gradient.addColorStop(1, "rgba(2, 10, 12, 0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    drawWordmark(width * 0.94, height * 0.94, Math.max(11, width * 0.0085), "right");
  }

  function drawScrim(width, height, layout) {
    const start = layout.wide
      ? Math.max(0, Math.min(height * 0.18, layout.contentTop - height * 0.16))
      : Math.min(height * 0.32, layout.contentTop - height * 0.1);
    const gradient = ctx.createLinearGradient(0, start, 0, height);
    gradient.addColorStop(0, "rgba(2, 10, 12, 0)");
    gradient.addColorStop(0.16, "rgba(2, 10, 12, 0.1)");
    gradient.addColorStop(0.34, "rgba(2, 10, 12, 0.36)");
    gradient.addColorStop(0.58, "rgba(2, 10, 12, 0.7)");
    gradient.addColorStop(0.8, "rgba(2, 10, 12, 0.88)");
    gradient.addColorStop(1, "rgba(2, 10, 12, 0.96)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /* ------------------------------------------------------------------ */
  /* Layout                                                              */
  /* ------------------------------------------------------------------ */

  function computeLayout(width, height, story) {
    const wide = width / height >= 1.32;
    const scale = Math.max(0.42, Math.min(width / 1920, height / 950, 3));
    const padX = width * (wide ? 0.055 : 0.072);
    const contentW = width - padX * 2;
    const footerBaseline = height - height * (wide ? 0.052 : 0.058);
    const footerLineY = footerBaseline - 44 * scale;

    const metricsCount = Math.max(1, story.metrics.length);
    const metricCols = wide
      ? (metricsCount <= 3 ? metricsCount : metricsCount === 4 ? 2 : 3)
      : (metricsCount <= 4 ? metricsCount : metricsCount >= 7 ? 4 : 3);
    const metricRows = Math.ceil(metricsCount / metricCols);
    const metricLabelSize = 40 * scale;
    const metricValueSize = 66 * scale;
    const metricRowH = 126 * scale;
    const metricRowGap = 22 * scale;
    const metricsH = metricRows * metricRowH + (metricRows - 1) * metricRowGap;
    const metricsBottom = footerLineY - 40 * scale;
    const metricsTop = metricsBottom - metricsH;

    const heroLabelSize = 40 * scale;
    const heroH = (wide ? 134 : 158) * scale;
    const heroGap = (wide ? 40 : 44) * scale;
    const heroTop = metricsTop - heroGap - heroH;
    const heroBaseline = heroTop + heroH;
    const heroFont = (wide ? 108 : 130) * scale;

    const hasTags = story.tags.length > 0;
    const tagSize = 40 * scale;
    const tagTracking = 3.6 * scale;
    const metaSize = 36 * scale;
    const metaTracking = 3.1 * scale;
    const titleSize = (wide ? 76 : 86) * scale;
    const footerSize = 34 * scale;

    if (wide) {
      const leftW = contentW * 0.55;
      const chartGap = contentW * 0.05;
      const chartX = padX + leftW + chartGap;
      const chartW = contentW - leftW - chartGap;
      const tagBaseline = hasTags ? heroTop - 66 * scale : null;
      const titleBaseline = hasTags
        ? tagBaseline - 62 * scale
        : heroTop - 44 * scale;
      const metaBaseline = titleBaseline - titleSize * 0.82 - 24 * scale;
      const chartY = metaBaseline - 2 * scale;

      return {
        wide: true,
        scale,
        padX,
        contentW,
        footerBaseline,
        footerLineY,
        titleSize,
        titleBaseline,
        titleMaxW: leftW,
        metaBaseline,
        metaRight: padX + leftW,
        metaSize,
        metaTracking,
        tagBaseline,
        tagSize,
        tagTracking,
        heroTop,
        heroFont,
        heroLabelSize,
        heroCellW: (leftW - 24 * scale) / 3,
        heroGap: 12 * scale,
        heroBaseline,
        metricsTop,
        metricCols,
        metricRows,
        metricCellW: leftW / metricCols,
        metricValueSize,
        metricLabelSize,
        metricRowH,
        metricRowStep: metricRowH + metricRowGap,
        chart: {
          x: chartX,
          y: chartY,
          w: chartW,
          h: footerLineY - 60 * scale - chartY,
          labelSize: 36 * scale,
          headerSize: 38 * scale,
          showAxes: false,
          showHeader: false,
        },
        footerSize,
        contentTop: metaBaseline - 24 * scale,
      };
    }

    const chartH = 230 * scale;
    const chartTop = heroTop - 28 * scale - chartH;
    const tagBaseline = hasTags ? chartTop - 62 * scale : null;
    const titleBaseline = hasTags
      ? tagBaseline - 64 * scale
      : chartTop - 52 * scale;
    const metaBaseline = titleBaseline - titleSize * 0.82 - 24 * scale;

    return {
      wide: false,
      scale,
      padX,
      contentW,
      footerBaseline,
      footerLineY,
      titleSize,
      titleBaseline,
      titleMaxW: contentW,
      metaBaseline,
      metaRight: padX + contentW,
      metaSize,
      metaTracking,
      tagBaseline,
      tagSize,
      tagTracking,
      heroTop,
      heroFont,
      heroLabelSize,
      heroCellW: (contentW - 24 * scale) / 3,
      heroGap: 12 * scale,
      heroBaseline,
      metricsTop,
      metricCols,
      metricRows,
      metricCellW: contentW / metricCols,
      metricValueSize,
      metricLabelSize,
      metricRowH,
      metricRowStep: metricRowH + metricRowGap,
      chart: {
        x: padX,
        y: chartTop,
        w: contentW,
        h: chartH,
        labelSize: 36 * scale,
        headerSize: 38 * scale,
        showAxes: false,
        showHeader: true,
      },
      footerSize,
      contentTop: metaBaseline - 24 * scale,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Story drawing                                                       */
  /* ------------------------------------------------------------------ */

  function drawStory(story, layout) {
    ctx.save();
    drawMeta(story, layout);
    drawTitle(story, layout);
    drawTags(story, layout);
    drawChart(story, layout);
    drawHero(story, layout);
    drawMetrics(story, layout);
    drawFooter(story, layout);
    ctx.restore();
  }

  function drawMeta(story, layout) {
    ctx.save();
    ctx.font = `400 ${layout.metaSize}px "DM Mono", monospace`;
    setLetterSpacing(layout.metaTracking);
    ctx.shadowColor = "rgba(2, 10, 12, 0.6)";
    ctx.shadowBlur = 10 * layout.scale;
    ctx.fillStyle = "rgba(224, 246, 240, 0.72)";
    ctx.textAlign = "left";
    const metaLine = layout.wide && story.dateLabel
      ? `${story.metaLeft} · ${story.dateLabel}`
      : story.metaLeft;
    ctx.fillText(metaLine, layout.padX, layout.metaBaseline);

    if (story.dateLabel && !layout.wide) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(224, 246, 240, 0.7)";
      ctx.fillText(story.dateLabel, layout.metaRight, layout.metaBaseline);
    }
    ctx.restore();
  }

  function drawTitle(story, layout) {
    let size = layout.titleSize;
    const maxWidth = layout.titleMaxW;
    let title = story.title;

    ctx.save();
    ctx.font = `500 ${size}px "Space Grotesk", sans-serif`;
    setLetterSpacing(-size * 0.028);
    while (ctx.measureText(title).width > maxWidth && size > layout.titleSize * 0.52) {
      size -= 1;
      ctx.font = `500 ${size}px "Space Grotesk", sans-serif`;
      setLetterSpacing(-size * 0.028);
    }
    if (ctx.measureText(title).width > maxWidth) {
      title = ellipsize(title, maxWidth);
    }

    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(title, layout.padX, layout.titleBaseline);
    ctx.restore();
  }

  function drawTags(story, layout) {
    if (!story.tags.length || layout.tagBaseline === null) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      layout.padX,
      layout.tagBaseline - layout.tagSize * 1.2,
      layout.titleMaxW,
      layout.tagSize * 2
    );
    ctx.clip();
    const separator = "  ·  ";
    let tagSize = layout.tagSize;
    const tagFont = (size) => `400 ${size}px "DM Mono", monospace`;
    ctx.font = tagFont(tagSize);
    setLetterSpacing(layout.tagTracking);
    const fullTagLine = story.tags.map((tag) => tag.label).join(separator);
    while (ctx.measureText(fullTagLine).width > layout.titleMaxW && tagSize > layout.tagSize * 0.72) {
      tagSize -= 0.5;
      ctx.font = tagFont(tagSize);
      setLetterSpacing(layout.tagTracking * (tagSize / layout.tagSize));
    }
    ctx.shadowColor = "rgba(2, 10, 12, 0.55)";
    ctx.shadowBlur = 8 * layout.scale;
    ctx.textAlign = "left";
    let x = layout.padX;

    story.tags.forEach((tag, index) => {
      if (index > 0) {
        ctx.fillStyle = "rgba(224, 246, 240, 0.36)";
        ctx.fillText(separator, x, layout.tagBaseline);
        x += ctx.measureText(separator).width;
      }
      ctx.fillStyle = tag.accent ? ACCENT : "rgba(224, 246, 240, 0.66)";
      ctx.fillText(tag.label, x, layout.tagBaseline);
      x += ctx.measureText(tag.label).width;
    });

    ctx.restore();
  }

  function drawHero(story, layout) {
    const stats = [
      { label: "DIVE TIME", value: story.duration, unit: "" },
      { label: "MAX DEPTH", value: story.maxDepth, unit: story.depthUnit },
      { label: "AVG DEPTH", value: story.avgDepth === null ? "—" : story.avgDepth, unit: story.avgDepth === null ? "" : story.depthUnit },
    ];

    ctx.save();
    ctx.textAlign = "left";

    stats.forEach((stat, index) => {
      const x = layout.padX + index * (layout.heroCellW + layout.heroGap);
      if (index > 0) {
        ctx.strokeStyle = HAIRLINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - layout.heroGap / 2, layout.heroTop + 2 * layout.scale);
        ctx.lineTo(x - layout.heroGap / 2, layout.heroBaseline + 2 * layout.scale);
        ctx.stroke();
      }

      ctx.font = `400 ${layout.heroLabelSize}px "DM Mono", monospace`;
      setLetterSpacing(layout.heroLabelSize * 0.15);
      ctx.fillStyle = "rgba(224, 246, 240, 0.66)";
      ctx.fillText(stat.label, x, layout.heroTop + layout.heroLabelSize);

      drawValueWithUnit(
        stat.value,
        stat.unit,
        x,
        layout.heroBaseline,
        layout.heroFont,
        layout.heroFont * 0.36,
        layout.heroCellW,
        INK,
        "rgba(224, 246, 240, 0.67)"
      );
    });

    ctx.restore();
  }

  function drawMetrics(story, layout) {
    if (!story.metrics.length) return;
    const cols = layout.metricCols;

    ctx.save();
    ctx.textAlign = "left";

    story.metrics.forEach((metric, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = layout.padX + col * layout.metricCellW;
      const y = layout.metricsTop + row * layout.metricRowStep;
      const textX = x + (col === 0 ? 0 : 14 * layout.scale);

      if (col > 0) {
        ctx.strokeStyle = HAIRLINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 1 * layout.scale);
        ctx.lineTo(x, y + layout.metricRowH - 2 * layout.scale);
        ctx.stroke();
      }

      let labelSize = layout.metricLabelSize;
      const labelMaxW = layout.metricCellW - 16 * layout.scale;
      const labelFont = (size) => `400 ${size}px "DM Mono", monospace`;
      ctx.font = labelFont(labelSize);
      setLetterSpacing(labelSize * 0.12);
      while (ctx.measureText(metric.label).width > labelMaxW && labelSize > layout.metricLabelSize * 0.72) {
        labelSize -= 0.5;
        ctx.font = labelFont(labelSize);
        setLetterSpacing(labelSize * 0.12);
      }
      ctx.fillStyle = "rgba(224, 246, 240, 0.62)";
      ctx.fillText(metric.label, textX, y + layout.metricLabelSize);

      drawValueWithUnit(
        metric.value,
        metric.unit,
        textX,
        y + 108 * layout.scale,
        layout.metricValueSize,
        layout.metricValueSize * 0.5,
        layout.metricCellW - 16 * layout.scale,
        "rgba(239, 250, 247, 0.96)",
        "rgba(224, 246, 240, 0.62)"
      );
    });

    ctx.restore();
  }

  function drawFooter(story, layout) {
    ctx.save();
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.padX, layout.footerLineY);
    ctx.lineTo(layout.padX + layout.contentW, layout.footerLineY);
    ctx.stroke();

    ctx.font = `400 ${layout.footerSize}px "DM Mono", monospace`;
    setLetterSpacing(layout.footerSize * 0.12);
    ctx.fillStyle = "rgba(224, 246, 240, 0.62)";
    ctx.textAlign = "left";
    ctx.fillText("SHEARWATER", layout.padX, layout.footerBaseline);

    const right = layout.padX + layout.contentW;
    const urlGap = 20 * layout.scale;
    ctx.font = `400 ${layout.footerSize}px "DM Mono", monospace`;
    setLetterSpacing(layout.footerSize * 0.06);
    const urlWidth = ctx.measureText(GITHUB_URL).width;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(224, 246, 240, 0.66)";
    ctx.fillText(GITHUB_URL, right, layout.footerBaseline);

    drawWordmark(
      right - urlWidth - urlGap,
      layout.footerBaseline,
      layout.footerSize,
      "right"
    );
    ctx.restore();
  }

  function drawWordmark(x, baseline, size, align) {
    ctx.save();
    ctx.textAlign = align;
    ctx.font = `600 ${size * 1.25}px "Space Grotesk", sans-serif`;
    setLetterSpacing(size * 0.2);
    ctx.fillStyle = "rgba(239, 250, 247, 0.78)";
    const text = "DIVE STORIES";
    ctx.fillText(text, x, baseline);

    const textWidth = ctx.measureText(text).width;
    const dotX = align === "right" ? x - textWidth - size * 0.9 : x + textWidth + size * 0.9;
    ctx.beginPath();
    ctx.arc(dotX, baseline - size * 0.33, Math.max(1.5, size * 0.19), 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.restore();
  }

  function drawChart(story, layout) {
    const chart = layout.chart;
    const points = story.chartPoints;
    if (!points.length) return;

    const scale = layout.scale;
    const headerY = chart.y + (chart.showAxes ? 0 : 2 * scale);

    ctx.save();
    if (chart.showHeader) {
      ctx.font = `400 ${chart.headerSize}px "DM Mono", monospace`;
      setLetterSpacing(chart.headerSize * 0.13);
      ctx.shadowColor = "rgba(2, 10, 12, 0.7)";
      ctx.shadowBlur = 12 * scale;
      ctx.fillStyle = "rgba(224, 246, 240, 0.76)";
      ctx.textAlign = "left";
      ctx.fillText("DEPTH PROFILE", chart.x, headerY);
    }

    let plotX = chart.x;
    let plotW = chart.w;
    const plotTop = headerY + 58 * scale;
    const plotBottom = chart.y + chart.h;
    const plotH = Math.max(20, plotBottom - plotTop);

    if (chart.showAxes) {
      const axisW = 60 * scale;
      plotX += axisW;
      plotW -= axisW;

      ctx.font = `400 ${chart.labelSize}px "DM Mono", monospace`;
      setLetterSpacing(0);
      ctx.fillStyle = "rgba(224, 246, 240, 0.78)";
      ctx.textAlign = "right";
      ctx.fillText("0", chart.x + axisW - 10 * scale, plotBottom);
      ctx.fillText(
        `${story.maxDepth} ${story.depthUnit}`,
        chart.x + axisW - 10 * scale,
        plotTop + chart.labelSize
      );

      ctx.textAlign = "left";
      ctx.fillText("0:00", plotX, plotBottom + 30 * scale);
      ctx.textAlign = "right";
      ctx.fillText(story.duration, plotX + plotW, plotBottom + 30 * scale);
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    const maxScale = Math.max(story.maxDepthM, 1) * 1.06;
    const xFor = (time) =>
      plotX + Math.max(0, Math.min(1, time / story.dive.durationSec)) * plotW;
    const yFor = (depthM) =>
      plotTop + plotH - Math.max(0, Math.min(1, depthM / maxScale)) * plotH;

    ctx.strokeStyle = "rgba(224, 246, 240, 0.09)";
    ctx.lineWidth = 1;
    for (let index = 1; index <= 3; index += 1) {
      const y = plotTop + (plotH * index) / 4;
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(xFor(0), plotBottom);
    points.forEach((point, index) => {
      const x = xFor(point.t);
      const y = yFor(point.depthM);
      if (index === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(story.dive.durationSec), plotBottom);
    ctx.closePath();

    const fill = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    fill.addColorStop(0, "rgba(157, 240, 218, 0.19)");
    fill.addColorStop(0.55, "rgba(157, 240, 218, 0.075)");
    fill.addColorStop(1, "rgba(157, 240, 218, 0.008)");
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xFor(point.t);
      const y = yFor(point.depthM);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(2, 10, 12, 0.35)";
    ctx.lineWidth = 7 * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = (chart.showAxes ? 2.2 : 2) * scale;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(157, 240, 218, 0.38)";
    ctx.shadowBlur = 10 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const peak = points.reduce(
      (best, point) => (point.depthM > best.depthM ? point : best),
      points[0]
    );
    const peakX = xFor(peak.t);
    const peakY = yFor(peak.depthM);
    ctx.beginPath();
    ctx.arc(peakX, peakY, 3.6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT_BRIGHT;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(peakX, peakY, 8 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(157, 240, 218, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function drawValueWithUnit(value, unit, x, baseline, valueSize, unitSize, maxWidth, valueColor, unitColor) {
    let size = valueSize;
    let unitWidth = unit
      ? measureWithFont(unit, unitSize, `500 ${unitSize}px "Space Grotesk", sans-serif`)
      : 0;
    let valueWidth = measureWithFont(value, size, `500 ${size}px "Space Grotesk", sans-serif`);
    const gap = unit ? size * 0.12 : 0;

    while (valueWidth + unitWidth + gap > maxWidth && size > valueSize * 0.52) {
      size -= 0.5;
      valueWidth = measureWithFont(value, size, `500 ${size}px "Space Grotesk", sans-serif`);
      const scaledUnit = unitSize * (size / valueSize);
      unitWidth = unit
        ? measureWithFont(unit, scaledUnit, `500 ${scaledUnit}px "Space Grotesk", sans-serif`)
        : 0;
    }

    const actualUnitSize = unitSize * (size / valueSize);
    ctx.save();
    ctx.font = `500 ${size}px "Space Grotesk", sans-serif`;
    setLetterSpacing(-size * 0.034);
    ctx.fillStyle = valueColor;
    ctx.textAlign = "left";
    ctx.fillText(value, x, baseline);

    if (unit) {
      ctx.font = `500 ${actualUnitSize}px "Space Grotesk", sans-serif`;
      setLetterSpacing(0);
      ctx.fillStyle = unitColor;
      ctx.textAlign = "left";
      ctx.fillText(unit, x + valueWidth + actualUnitSize * 0.18, baseline);
    }
    ctx.restore();
  }

  function measureWithFont(text, size, font) {
    ctx.save();
    ctx.font = font;
    setLetterSpacing(-size * 0.034);
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  function ellipsize(text, maxWidth) {
    let result = text;
    while (result.length > 1 && ctx.measureText(result + "…").width > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result}…`;
  }

  function setLetterSpacing(value) {
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${value}px`;
  }

  /* ------------------------------------------------------------------ */
  /* Download                                                            */
  /* ------------------------------------------------------------------ */

  function downloadStory() {
    if (!state.photo || !state.dive) return;
    render();
    canvas.toBlob((blob) => {
      if (!blob) {
        showFileError("The image couldn’t be exported. Try a different photo.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      const label = els.downloadBtn.querySelector("span");
      if (label) {
        label.textContent = "Saved";
        els.downloadBtn.classList.add("is-saved");
        window.clearTimeout(state.savedTimer);
        state.savedTimer = window.setTimeout(() => {
          label.textContent = "Download";
          els.downloadBtn.classList.remove("is-saved");
        }, 1800);
      }
    }, "image/png");
  }

  function buildFileName() {
    const parts = ["dive-story"];
    if (state.dive && state.dive.number) parts.push(state.dive.number);
    if (state.site.trim()) {
      parts.push(
        state.site
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)
      );
    }
    return `${parts.filter(Boolean).join("-")}.png`;
  }
})();
