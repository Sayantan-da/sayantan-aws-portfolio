/* ==========================================================================
   Sayantan Ghosh — Interactive Portfolio & "The Museum of My Mistakes"
   Vanilla JavaScript (Zero build step, zero external libraries)
   Interactive Features:
   1. 7-Exhibit "Museum of My Mistakes" + Broken vs. Fixed Code Diff Viewer
   2. Interactive AWS Cloud Shell Terminal in Hero (run commands or tap chips)
   3. Live FastAPI Endpoint Simulator for all 4 Resume Projects
   4. Interactive AWS Amplify + S3 + CloudFront Architecture Inspector
   5. Filterable Skills Matrix + Ctrl+K / Cmd+K Quick Command Palette
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Exhibit Data ("The Museum of My Mistakes" + Broken vs Fixed Code Diffs)
     ------------------------------------------------------------------------ */
  var EXHIBITS = [
    {
      id: "exhibit-1",
      number: "Exhibit 01",
      tag: "Nyaya AI",
      title: "The Unchunked 80-Page PDF Crash",
      teaser: "Feeding entire legal PDFs straight into an LLM context window in one FastAPI request.",
      built: "Nyaya AI, a multilingual (English, Hindi, Bengali) legal assistant using FastAPI and LLMs to summarize PDF legal documents and answer citizen queries in plain language.",
      failed: "In my first prototype, uploading a 60-page court judgment sent all extracted text in a single synchronous prompt. It blew past the LLM token limit, blocked the FastAPI worker thread for 40+ seconds, and mangled Bengali UTF-8 characters when cutting strings by byte length.",
      learned: "I switched to paragraph-aware text chunking with token budgets, explicit UTF-8 decoding before slicing multilingual strings, and async request handling in FastAPI so one large PDF never stalls other users.",
      brokenCode:
        "# BROKEN: Synchronous full-PDF dump & unsafe byte slicing\n" +
        "@app.post('/summarize')\n" +
        "def summarize_judgment(file: UploadFile):\n" +
        "    raw_bytes = file.file.read() # Blocks event loop\n" +
        "    clipped = raw_bytes[:12000].decode('utf-8', errors='ignore') # Cuts Bengali multi-byte chars in half!\n" +
        "    return llm.generate(prompt=f'Summarize in Bengali: {clipped}')",
      fixedCode:
        "# FIXED: Async read + UTF-8 paragraph chunking with token budget\n" +
        "@app.post('/summarize')\n" +
        "async def summarize_judgment(file: UploadFile):\n" +
        "    text = (await file.read()).decode('utf-8')\n" +
        "    chunks = chunk_by_paragraphs(text, max_tokens=1800) # Preserves Bengali/Hindi sentences\n" +
        "    summaries = await asyncio.gather(*(llm.agenerate(c) for c in chunks))\n" +
        "    return {'language': 'bn-IN', 'summary': merge_summaries(summaries)}",
      hasScreenshot: false
    },
    {
      id: "exhibit-2",
      number: "Exhibit 02",
      tag: "Kolkata Metro API",
      title: "The North-South vs. East-West Station Mix-Up",
      teaser: "Trusting unvalidated station names and flat route lists across interchangeable metro lines.",
      built: "A documented FastAPI REST service giving developers structured JSON endpoints for Kolkata Metro stations, timings, and fare calculation.",
      failed: "Early on, I stored stations in a flat list and matched queries by loose lowercase substrings. Searching 'Esplanade' or 'Rabindra' returned ambiguous matches or calculated fares across Blue Line and Green Line corridors without accounting for interchange rules.",
      learned: "I introduced strict Pydantic schema validation, canonical station codes per corridor (Blue, Green, Purple, Orange), and explicit HTTP 422 error payloads that tell API consumers exactly which station code or line parameter is invalid.",
      brokenCode:
        "# BROKEN: Flat station list with loose substring lookup\n" +
        "@app.get('/fare')\n" +
        "def get_fare(from_st: str, to_st: str):\n" +
        "    # 'Rabindra' matches both Rabindra Sadan AND Rabindra Sarobar!\n" +
        "    s1 = [s for s in STATIONS if from_st.lower() in s['name'].lower()][0]\n" +
        "    s2 = [s for s in STATIONS if to_st.lower() in s['name'].lower()][0]\n" +
        "    return {'fare_inr': abs(s1['index'] - s2['index']) * 5}",
      fixedCode:
        "# FIXED: Canonical station codes & Pydantic corridor validation\n" +
        "class RouteQuery(BaseModel):\n" +
        "    origin_code: Literal['DAK', 'DUM', 'ESP', 'RSD', 'RSB', 'SLK_V', 'HWH']\n" +
        "    dest_code: Literal['DAK', 'DUM', 'ESP', 'RSD', 'RSB', 'SLK_V', 'HWH']\n\n" +
        "@app.get('/v1/fare', response_model=FareResponse)\n" +
        "async def calculate_fare(q: RouteQuery = Depends()):\n" +
        "    return compute_interchange_fare(q.origin_code, q.dest_code)",
      hasScreenshot: false
    },
    {
      id: "exhibit-3",
      number: "Exhibit 03",
      tag: "AWS Log Analyzer",
      title: "The Alert Storm That Summarized Itself",
      teaser: "Calling an LLM on every single error line during a Linux server log spike.",
      built: "An AI-powered incident assistant that ingests Linux server logs on AWS, detects error-rate anomalies in Python, and sends plain-English root-cause explanations via FastAPI.",
      failed: "When simulating a database connection failure, the server emitted 400 identical stack traces in 30 seconds. My script triggered an LLM API call and notification for every window without deduplication—burning API quota and flooding the alert channel.",
      learned: "I separated anomaly detection from LLM summarization: Python first groups logs by error signature hash and applies a cooldown window, invoking the LLM only once per unique incident spike.",
      brokenCode:
        "# BROKEN: Invoking LLM on every single ERROR line in /var/log/syslog\n" +
        "for line in tail_aws_linux_logs('/var/log/app.log'):\n" +
        "    if 'ERROR' in line:\n" +
        "        # 400 DB timeouts in 30s = 400 expensive LLM calls!\n" +
        "        explanation = llm.explain_incident(line)\n" +
        "        send_slack_alert(explanation)",
      fixedCode:
        "# FIXED: SHA-256 signature deduplication + 300s cooldown window\n" +
        "sig_hash = hashlib.sha256(normalize_trace(line).encode()).hexdigest()[:12]\n" +
        "window = sliding_windows[sig_hash].record_event(now)\n" +
        "if window.is_anomaly() and not cooldown_cache.is_muted(sig_hash):\n" +
        "    cooldown_cache.mute(sig_hash, ttl_seconds=300)\n" +
        "    summary = await llm.summarize_window(window.sample_logs, count=window.count)\n" +
        "    await notify_oncall(sig_hash, summary)",
      hasScreenshot: false
    },
    {
      id: "exhibit-4",
      number: "Exhibit 04",
      tag: "HealthFlow ETL",
      title: "The Nested FHIR Null That Halted a Batch",
      teaser: "Assuming clinical JSON records always had populated patient telecom and address arrays.",
      built: "HealthFlow, an end-to-end healthcare ETL pipeline and PostgreSQL warehouse that ingests CSV, JSON, and FHIR sources with PHI de-identification and audit logging.",
      failed: "Midway through a 10,000-record ingestion test, a single FHIR bundle lacked an optional 'telecom' field. Because my transform step chained dictionary keys directly and ran inside one giant PostgreSQL transaction, the entire batch rolled back.",
      learned: "I implemented defensive schema validation with dead-letter quarantine tables: malformed records are logged to an audit table for inspection while valid records commit cleanly in smaller, idempotent batches.",
      brokenCode:
        "# BROKEN: Unchecked dict key access inside a monolithic transaction\n" +
        "with db.transaction(): # 1 bad record rolls back all 10,000 rows!\n" +
        "    for record in fhir_bundle:\n" +
        "        phone = record['resource']['telecom'][0]['value'] # KeyError!\n" +
        "        db.execute(INSERT_PATIENT_SQL, mask_phi(record, phone))",
      fixedCode:
        "# FIXED: Defensive extraction + Dead-Letter Quarantine Table\n" +
        "for batch in chunked(fhir_bundle, size=500):\n" +
        "    valid_rows, quarantined = [], []\n" +
        "    for rec in batch:\n" +
        "        parsed, err = validate_and_mask_fhir(rec) # Safe .get() + Pydantic\n" +
        "        (valid_rows if not err else quarantined).append(parsed or err)\n" +
        "    db.bulk_upsert_patients(valid_rows)\n" +
        "    db.log_quarantine_audit(quarantined)",
      hasScreenshot: false
    },
    {
      id: "exhibit-5",
      number: "Exhibit 05",
      tag: "AWS Amplify",
      title: "The Hackathon Bug: Linux Case-Sensitivity & /dist",
      teaser: "Why 'Amplify-Log.png' and default build folders worked locally on Windows/macOS but broke on AWS Linux.",
      built: "This zero-build static portfolio site (plain HTML, CSS, and vanilla JS) deployed on AWS Amplify Hosting with Amazon S3 and CloudFront behind it.",
      failed: "During my initial Amplify deployment test, two things failed back-to-back: Amplify's default build config looked for a '/dist' output folder (throwing 'CustomerError: Artifact directory /dist does not exist'), and an image referenced as 'assets/Amplify-Log.png' returned 404 on Amplify's case-sensitive Amazon Linux container even though it loaded fine locally.",
      learned: "For plain static sites on AWS Amplify, set 'baseDirectory: /' in amplify.yml (or leave build output at root) and enforce strict lowercase kebab-case filenames across every HTML, CSS, and JS reference before pushing to Git.",
      brokenCode:
        "# BROKEN: Default amplify.yml expecting /dist + Mixed-Case asset path\n" +
        "artifacts:\n" +
        "  baseDirectory: /dist   # ERROR: Artifact directory '/dist' does not exist\n" +
        "  files:\n" +
        "    - '**/*'\n" +
        "<!-- HTML had uppercase 'A' & 'L', Linux file was lowercase -->\n" +
        "<img src=\"assets/Amplify-Log.png\" alt=\"Build log\"> <!-- 404 on Amazon Linux! -->",
      fixedCode:
        "# FIXED: Root baseDirectory in amplify.yml + Strict lowercase filenames\n" +
        "version: 1\n" +
        "frontend:\n" +
        "  artifacts:\n" +
        "    baseDirectory: /\n" +
        "    files:\n" +
        "      - '**/*'\n" +
        "<!-- Verified lowercase path matching Amazon Linux filesystem -->\n" +
        "<img src=\"assets/amplify-build-log-placeholder.svg\" alt=\"Verified build log\">",
      hasScreenshot: true
    },
    {
      id: "exhibit-6",
      number: "Exhibit 06",
      tag: "Nyaya AI / FastAPI",
      title: "The Async Event-Loop Freeze: CPU-Bound PDF Extraction",
      teaser: "Why calling pypdf text extraction inside async def froze all concurrent user requests.",
      built: "An asynchronous FastAPI endpoint to accept uploaded legal court rulings (up to 40 pages) and extract plain text for downstream LLM embedding and summarization.",
      failed: "When defining the route as 'async def', running synchronous 'pypdf.PdfReader.extract_text()' executed directly on Python's single asyncio event loop thread. Processing a dense 35-page judgment pinned the worker thread for 6.8 seconds, causing all concurrent requests (including Kubernetes/AWS health checks and user queries) to hang with 504 Gateway Timeouts.",
      learned: "FastAPI executes 'async def' routes directly on the event loop—heavy CPU-bound work (like document parsing and regex hashing) must be offloaded to worker threads via 'asyncio.to_thread()' or Starlette's threadpool so the event loop stays responsive.",
      brokenCode:
        "# BROKEN: CPU-bound PDF parser inside async def freezes entire event loop!\n" +
        "@app.post('/v1/documents/extract')\n" +
        "async def extract_judgment_text(file: UploadFile):\n" +
        "    raw_bytes = await file.read()\n" +
        "    # Synchronous CPU parser blocks event loop for 6-8 seconds!\n" +
        "    reader = PdfReader(io.BytesIO(raw_bytes))\n" +
        "    extracted = ''.join(page.extract_text() or '' for page in reader.pages)\n" +
        "    return {'chars': len(extracted), 'status': 'extracted'}",
      fixedCode:
        "# FIXED: Offload CPU-bound parsing to worker threadpool via asyncio.to_thread\n" +
        "@app.post('/v1/documents/extract')\n" +
        "async def extract_judgment_text(file: UploadFile):\n" +
        "    raw_bytes = await file.read()\n\n" +
        "    def parse_pdf_sync(data: bytes) -> str:\n" +
        "        reader = PdfReader(io.BytesIO(data))\n" +
        "        return ''.join(p.extract_text() or '' for p in reader.pages)\n\n" +
        "    # Event loop remains completely free to serve concurrent users:\n" +
        "    extracted = await asyncio.to_thread(parse_pdf_sync, raw_bytes)\n" +
        "    return {'chars': len(extracted), 'status': 'extracted'}",
      hasScreenshot: false
    },
    {
      id: "exhibit-7",
      number: "Exhibit 07",
      tag: "AWS Log Analyzer",
      title: "Catastrophic Regex Backtracking on Multi-Line Stack Traces",
      teaser: "How a greedy regex pattern on unexpected server stack dumps pegged EC2 CPU at 100%.",
      built: "A high-throughput log ingestion parser in Python designed to extract timestamps, log severity levels (INFO/WARN/ERROR), and error payloads from AWS Linux syslogs and application logs.",
      failed: "I wrote a regex with nested quantifiers ('r\"^\\[(.*?)\\]\\s+([A-Z]+)\\s+((.*?\\s*)+)$\"') to capture multi-line Java and Python exception traces. When a 75-line database connection stack trace with irregular whitespace arrived, Python's 're' engine suffered catastrophic exponential backtracking (ReDoS), pegging the EC2 instance CPU at 100% and stalling the log pipeline for 140 seconds.",
      learned: "Never use nested greedy quantifiers on variable-length server log text. I switched to pre-compiled fixed-prefix regexes with strict length boundaries ('line[:2048]'), falling back to deterministic string splitting ('line.split()') which guarantees linear O(N) execution time.",
      brokenCode:
        "# BROKEN: Nested quantifiers ((.*\\s*)+) cause catastrophic ReDoS backtracking!\n" +
        "import re\n\n" +
        "LOG_PATTERN = re.compile(r'^\\[(?P<time>.*?)\\]\\s+(?P<level>[A-Z]+)\\s+((.*?\\s*)+)$')\n\n" +
        "def parse_syslog_line(raw_line: str):\n" +
        "    # 70-line Java stack trace causes O(2^N) backtracking, pegging CPU at 100%!\n" +
        "    match = LOG_PATTERN.match(raw_line)\n" +
        "    return match.groupdict() if match else None",
      fixedCode:
        "# FIXED: Bounded input + non-backtracking prefix match & deterministic split\n" +
        "import re\n\n" +
        "PREFIX_RE = re.compile(r'^\\[(?P<time>\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})\\]\\s+(?P<level>INFO|WARN|ERROR)\\s+')\n\n" +
        "def parse_syslog_line(raw_line: str) -> dict:\n" +
        "    bounded = raw_line[:2048] # Prevent runaway memory allocation\n" +
        "    match = PREFIX_RE.match(bounded)\n" +
        "    if not match:\n" +
        "        return {'level': 'RAW', 'payload': bounded.strip()}\n" +
        "    return {\n" +
        "        'timestamp': match.group('time'),\n" +
        "        'level': match.group('level'),\n" +
        "        'payload': bounded[match.end():].strip()\n" +
        "    } # Guaranteed O(N) linear time",
      hasScreenshot: false
    }
  ];

  /* ------------------------------------------------------------------------
     2. Live FastAPI Endpoint Simulator Data (For the 4 Resume Projects)
     ------------------------------------------------------------------------ */
  var API_SIMULATIONS = {
    nyaya: {
      name: "Nyaya AI — Multilingual Legal Assistant API",
      method: "POST /api/v1/legal/summarize",
      request: JSON.stringify({
        document_id: "calcutta_hc_tenancy_2026.pdf",
        pages_parsed: 42,
        target_language: "bn-IN (Bengali)",
        query: "What is the notice period for commercial lease termination?"
      }, null, 2),
      response: JSON.stringify({
        status: 200,
        engine: "FastAPI + Chunked LLM Pipeline",
        chunks_processed: 14,
        utf8_safe: true,
        summary_en: "Under Section 106 of the Transfer of Property Act, commercial tenancy requires 15 days clear notice unless overridden by a registered lease deed.",
        summary_bn: "সম্পত্তি হস্তান্তর আইনের ১০৬ ধারা অনুযায়ী, নিবন্ধিত চুক্তিতে অন্যথা না থাকলে বাণিজ্যিক ইজারার ক্ষেত্রে ১৫ দিনের নোটিশ প্রয়োজন।",
        latency_ms: 640
      }, null, 2)
    },
    loganalyzer: {
      name: "AWS Linux Log Analyzer & Incident Assistant",
      method: "POST /api/v1/incidents/analyze-window",
      request: JSON.stringify({
        host: "ip-172-31-18-42.ap-south-1.compute.internal",
        log_source: "/var/log/fastapi-worker.log",
        window_seconds: 30,
        raw_error_count: 412,
        unique_signature_hash: "9f86d081884c"
      }, null, 2),
      response: JSON.stringify({
        status: 200,
        anomaly_detected: true,
        deduplicated_calls_saved: 411,
        severity: "HIGH",
        plain_english_root_cause: "PostgreSQL connection pool exhausted (max_connections=100 reached) due to unclosed cursor in /v1/reports endpoint.",
        recommended_fix: "Increase PgBouncer pool_size and wrap session in async context manager.",
        alert_dispatched_to: ["slack://#oncall-backend", "Sayantanghosh214@gmail.com"]
      }, null, 2)
    },
    metro: {
      name: "Kolkata Metro REST API",
      method: "GET /api/v1/route?origin=DUM&dest=SLK_V",
      request: JSON.stringify({
        origin_code: "DUM (Dum Dum — Blue Line)",
        dest_code: "SLK_V (Salt Lake Sector V — Green Line)",
        passenger_type: "smart_card"
      }, null, 2),
      response: JSON.stringify({
        status: 200,
        validated_by: "Pydantic v2 RouteSchema",
        interchange_station: "ESP (Esplanade)",
        corridors: ["Blue Line (North-South)", "Green Line (East-West)"],
        total_stops: 17,
        estimated_minutes: 38,
        fare_inr: 35
      }, null, 2)
    },
    healthflow: {
      name: "HealthFlow — Healthcare FHIR ETL Warehouse API",
      method: "POST /api/v1/etl/ingest-batch",
      request: JSON.stringify({
        batch_id: "fhir_kolkata_clinic_2026_10_31",
        source_formats: ["FHIR_R4_JSON", "HL7_CSV"],
        total_records: 500,
        phi_masking_mode: "HIPAA_SAFE_HARBOR_SHA256"
      }, null, 2),
      response: JSON.stringify({
        status: 200,
        warehouse: "PostgreSQL (Supabase)",
        records_committed: 498,
        records_quarantined: 2,
        quarantine_reason: "Missing optional telecom array in 2 records — routed to audit_quarantine_log without batch rollback",
        phi_fields_deidentified: ["patient_name", "phone", "aadhaar_ref"]
      }, null, 2)
    }
  };

  /* ------------------------------------------------------------------------
     3. Interactive AWS Architecture Node Details
     ------------------------------------------------------------------------ */
  var AWS_NODES = [
    {
      step: "Step 01 • Source Control",
      title: "GitHub Repository (@Sayantan-da)",
      detail: "Holds index.html, styles.css, script.js, amplify.yml, and lowercase SVG assets in a clean Git repository with .gitignore blocking any .env or key files. Pushing to 'main' triggers an AWS Amplify webhook automatically."
    },
    {
      step: "Step 02 • CI/CD Build Container",
      title: "AWS Amplify Hosting (Amazon Linux)",
      detail: "Spins up an Amazon Linux build environment, reads amplify.yml (with baseDirectory: '/' so no '/dist' error occurs), and verifies that all case-sensitive asset paths exist before deployment."
    },
    {
      step: "Step 03 • Managed Origin Storage",
      title: "Amazon S3 Bucket",
      detail: "Stores the verified static HTML, CSS, JS, and SVG files durability in an AWS-managed S3 origin bucket. Atomic deployments ensure visitors never see a half-uploaded page."
    },
    {
      step: "Step 04 • Global Edge Delivery",
      title: "Amazon CloudFront CDN",
      detail: "Serves the portfolio globally over HTTPS (TLS 1.3) with Brotli/Gzip compression from edge locations (including Mumbai & Kolkata PoPs in India) and invalidates cached files on every push."
    }
  ];

  /* ------------------------------------------------------------------------
     4. Museum Gallery & Code Diff Logic
     ------------------------------------------------------------------------ */
  var topMuseumSignBtn = document.getElementById("top-museum-sign");
  var navMuseumLink = document.getElementById("nav-museum-link");
  var toggleGalleryBtn = document.getElementById("toggle-gallery-btn");
  var museumWing = document.getElementById("museum-wing");
  var exhibitsContainer = document.getElementById("exhibits-grid");

  var placardDrawer = document.getElementById("placard-drawer");
  var placardKicker = document.getElementById("placard-kicker");
  var placardTitle = document.getElementById("placard-title");
  var placardBuilt = document.getElementById("placard-built");
  var placardFailed = document.getElementById("placard-failed");
  var placardLearned = document.getElementById("placard-learned");
  var placardScreenshotBox = document.getElementById("placard-screenshot-box");

  var diffBrokenBtn = document.getElementById("diff-broken-btn");
  var diffFixedBtn = document.getElementById("diff-fixed-btn");
  var diffCodeDisplay = document.getElementById("diff-code-display");

  var prevExhibitBtn = document.getElementById("prev-exhibit-btn");
  var nextExhibitBtn = document.getElementById("next-exhibit-btn");
  var closePlacardBtn = document.getElementById("close-placard-btn");

  var screenshotInput = document.getElementById("screenshot-file-input");
  var screenshotImg = document.getElementById("hackathon-bug-img");
  var screenshotCaption = document.getElementById("screenshot-caption");

  var currentExhibitIndex = 0;
  var currentDiffMode = "fixed"; // 'broken' or 'fixed'
  var lastFocusedExhibitBtn = null;

  function renderExhibits() {
    if (!exhibitsContainer) return;
    exhibitsContainer.innerHTML = "";

    EXHIBITS.forEach(function (exhibit, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "exhibit-frame";
      btn.id = "frame-" + exhibit.id;
      btn.setAttribute("aria-expanded", index === currentExhibitIndex && !placardDrawer.hidden ? "true" : "false");
      btn.setAttribute("aria-controls", "placard-drawer");

      if (index === currentExhibitIndex && !placardDrawer.hidden) {
        btn.classList.add("active-exhibit");
      }

      btn.innerHTML =
        '<div>' +
          '<div class="exhibit-number">' +
            '<span>' + exhibit.number + '</span>' +
            '<span class="exhibit-tag">' + exhibit.tag + '</span>' +
          '</div>' +
          '<h3 class="exhibit-title">' + exhibit.title + '</h3>' +
          '<p class="exhibit-teaser">' + exhibit.teaser + '</p>' +
        '</div>' +
        '<span class="exhibit-cta">Inspect Placard &amp; Code Diff &rarr;</span>';

      btn.addEventListener("click", function () {
        lastFocusedExhibitBtn = btn;
        openPlacard(index, true);
      });

      exhibitsContainer.appendChild(btn);
    });
  }

  function renderDiffSnippet() {
    var item = EXHIBITS[currentExhibitIndex];
    if (!item || !diffCodeDisplay) return;

    if (currentDiffMode === "broken") {
      diffCodeDisplay.textContent = item.brokenCode;
      if (diffBrokenBtn) diffBrokenBtn.className = "diff-tab-btn active-diff-broken";
      if (diffFixedBtn) diffFixedBtn.className = "diff-tab-btn";
    } else {
      diffCodeDisplay.textContent = item.fixedCode;
      if (diffBrokenBtn) diffBrokenBtn.className = "diff-tab-btn";
      if (diffFixedBtn) diffFixedBtn.className = "diff-tab-btn active-diff-fixed";
    }
  }

  function openPlacard(index, shouldFocusPlacard) {
    if (index < 0) index = EXHIBITS.length - 1;
    if (index >= EXHIBITS.length) index = 0;
    currentExhibitIndex = index;

    var item = EXHIBITS[currentExhibitIndex];

    if (museumWing && museumWing.hidden) {
      museumWing.hidden = false;
      if (toggleGalleryBtn) {
        toggleGalleryBtn.setAttribute("aria-expanded", "true");
        toggleGalleryBtn.textContent = "Collapse Gallery Wing";
      }
    }

    placardKicker.textContent = item.number + " • " + item.tag + " (" + (currentExhibitIndex + 1) + " of " + EXHIBITS.length + ")";
    placardTitle.textContent = item.title;
    placardBuilt.textContent = item.built;
    placardFailed.textContent = item.failed;
    placardLearned.textContent = item.learned;

    renderDiffSnippet();

    if (placardScreenshotBox) {
      placardScreenshotBox.hidden = !item.hasScreenshot;
    }

    placardDrawer.hidden = false;
    updateFrameSelectionStates();

    if (shouldFocusPlacard && closePlacardBtn) {
      placardDrawer.scrollIntoView({ behavior: getScrollBehavior(), block: "nearest" });
      closePlacardBtn.focus();
    }
  }

  function closePlacard() {
    if (!placardDrawer) return;
    placardDrawer.hidden = true;
    updateFrameSelectionStates();
    if (lastFocusedExhibitBtn) {
      lastFocusedExhibitBtn.focus();
    }
  }

  function updateFrameSelectionStates() {
    var frames = exhibitsContainer ? exhibitsContainer.querySelectorAll(".exhibit-frame") : [];
    for (var i = 0; i < frames.length; i++) {
      var isSelected = (i === currentExhibitIndex) && !placardDrawer.hidden;
      frames[i].setAttribute("aria-expanded", isSelected ? "true" : "false");
      if (isSelected) {
        frames[i].classList.add("active-exhibit");
      } else {
        frames[i].classList.remove("active-exhibit");
      }
    }
  }

  function getScrollBehavior() {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduced ? "auto" : "smooth";
  }

  function jumpToMuseumAndOpen(exhibitIdx) {
    if (museumWing && museumWing.hidden) {
      museumWing.hidden = false;
      if (toggleGalleryBtn) {
        toggleGalleryBtn.setAttribute("aria-expanded", "true");
        toggleGalleryBtn.textContent = "Collapse Gallery Wing";
      }
    }
    var museumSection = document.getElementById("museum");
    if (museumSection) {
      museumSection.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
    }
    openPlacard(typeof exhibitIdx === "number" ? exhibitIdx : 0, false);
  }

  if (topMuseumSignBtn) {
    topMuseumSignBtn.addEventListener("click", function () {
      jumpToMuseumAndOpen(0);
    });
  }

  if (navMuseumLink) {
    navMuseumLink.addEventListener("click", function (e) {
      e.preventDefault();
      jumpToMuseumAndOpen(currentExhibitIndex);
    });
  }

  if (toggleGalleryBtn) {
    toggleGalleryBtn.addEventListener("click", function () {
      var isHidden = museumWing.hidden;
      museumWing.hidden = !isHidden;
      toggleGalleryBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
      toggleGalleryBtn.textContent = isHidden ? "Collapse Gallery Wing" : "Open Gallery Wing (" + EXHIBITS.length + " Exhibits)";
    });
  }

  if (diffBrokenBtn) {
    diffBrokenBtn.addEventListener("click", function () {
      currentDiffMode = "broken";
      renderDiffSnippet();
    });
  }

  if (diffFixedBtn) {
    diffFixedBtn.addEventListener("click", function () {
      currentDiffMode = "fixed";
      renderDiffSnippet();
    });
  }

  if (prevExhibitBtn) {
    prevExhibitBtn.addEventListener("click", function () {
      openPlacard(currentExhibitIndex - 1, false);
    });
  }

  if (nextExhibitBtn) {
    nextExhibitBtn.addEventListener("click", function () {
      openPlacard(currentExhibitIndex + 1, false);
    });
  }

  if (closePlacardBtn) {
    closePlacardBtn.addEventListener("click", function () {
      closePlacard();
    });
  }

  /* ------------------------------------------------------------------------
     5. Interactive Hero Cloud Shell Terminal
     ------------------------------------------------------------------------ */
  var terminalOutput = document.getElementById("terminal-output");
  var terminalInput = document.getElementById("terminal-input");
  var terminalRunBtn = document.getElementById("terminal-run-btn");
  var termChips = document.querySelectorAll(".term-chip-btn");

  var TERMINAL_COMMANDS = {
    help:
      "Available commands:\n" +
      "  whoami          -> Profile, MCA college & Kolkata base\n" +
      "  skills          -> Backend, AI/LLM, Database & AWS stack\n" +
      "  projects        -> List 4 shipped backend & AI builds\n" +
      "  mistakes        -> Jump straight to The Museum of My Mistakes\n" +
      "  aws-status      -> Verify Amplify + S3 + CloudFront config\n" +
      "  clear           -> Clear terminal output",
    whoami:
      "Sayantan Ghosh | Backend & AI Engineer\n" +
      "• Degree: MCA @ Techno International, Newtown (MAKAUT, 2025-2027)\n" +
      "• Undergrad: BCA @ Techno India College of Technology (2022-2025)\n" +
      "• Location: Newtown, Kolkata • Languages: English, Bengali, Hindi",
    skills:
      "LANGUAGES : Python, Java, SQL, HTML5/CSS3, JS (ES6+)\n" +
      "BACKEND   : FastAPI, Django, Flask, REST APIs, Pydantic\n" +
      "AI / NLP  : LLM Integration, PDF Summarization, Log Anomaly Detection\n" +
      "CLOUD/DB  : AWS (Amplify, S3, CloudFront, Linux), PostgreSQL (Supabase)",
    projects:
      "1. Nyaya AI         -> Trilingual (EN/HI/BN) FastAPI + LLM Legal Assistant\n" +
      "2. AWS Log Analyzer -> Linux Log Anomaly Detection & LLM Root-Cause Alerts\n" +
      "3. Kolkata Metro API-> Validated FastAPI REST Service for Metro Corridors\n" +
      "4. HealthFlow       -> FHIR/CSV Healthcare ETL & PostgreSQL Data Warehouse",
    "aws-status":
      "[OK] Hosting   : AWS Amplify Continuous Deployment (amplify.yml root)\n" +
      "[OK] Storage   : Amazon S3 Managed Origin Bucket\n" +
      "[OK] Edge CDN  : Amazon CloudFront HTTPS (Brotli enabled)\n" +
      "[OK] Linux Case: All assets verified lowercase kebab-case"
  };

  function executeTerminalCommand(rawCmd) {
    if (!terminalOutput) return;
    var cmd = (rawCmd || "").trim().toLowerCase();
    if (!cmd) return;

    if (cmd === "clear") {
      terminalOutput.textContent = "sayantan@aws-kolkata:~$ Terminal cleared. Type 'help' or tap a command above.";
      return;
    }

    if (cmd === "mistakes") {
      terminalOutput.textContent += "\n\nsayantan@aws-kolkata:~$ mistakes\nOpening The Museum of My Mistakes (" + EXHIBITS.length + " Exhibits)...";
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
      jumpToMuseumAndOpen(0);
      return;
    }

    var reply = TERMINAL_COMMANDS[cmd] ||
      "Command not recognized: '" + cmd + "'. Try: help, whoami, skills, projects, mistakes, aws-status, clear.";

    terminalOutput.textContent += "\n\nsayantan@aws-kolkata:~$ " + cmd + "\n" + reply;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  if (terminalRunBtn && terminalInput) {
    terminalRunBtn.addEventListener("click", function () {
      executeTerminalCommand(terminalInput.value);
      terminalInput.value = "";
    });

    terminalInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        executeTerminalCommand(terminalInput.value);
        terminalInput.value = "";
      }
    });
  }

  for (var c = 0; c < termChips.length; c++) {
    termChips[c].addEventListener("click", function () {
      var cmd = this.getAttribute("data-cmd");
      executeTerminalCommand(cmd);
    });
  }

  /* ------------------------------------------------------------------------
     6. Interactive Skills Filter Matrix
     ------------------------------------------------------------------------ */
  var skillFilterBtns = document.querySelectorAll(".skill-filter-btn");
  var skillTags = document.querySelectorAll(".skill-tag");

  for (var f = 0; f < skillFilterBtns.length; f++) {
    skillFilterBtns[f].addEventListener("click", function () {
      var filterCat = this.getAttribute("data-filter");

      for (var b = 0; b < skillFilterBtns.length; b++) {
        skillFilterBtns[b].classList.remove("active-filter");
      }
      this.classList.add("active-filter");

      for (var t = 0; t < skillTags.length; t++) {
        var tagProjects = skillTags[t].getAttribute("data-projects") || "";
        if (filterCat === "all") {
          skillTags[t].classList.remove("highlighted-skill");
        } else if (tagProjects.indexOf(filterCat) !== -1) {
          skillTags[t].classList.add("highlighted-skill");
        } else {
          skillTags[t].classList.remove("highlighted-skill");
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     7. Live FastAPI Endpoint Simulator (Projects Section)
     ------------------------------------------------------------------------ */
  var apiTabBtns = document.querySelectorAll(".api-tab-btn");
  var projectSimBtns = document.querySelectorAll(".project-sim-btn");
  var apiMethodLabel = document.getElementById("api-method-label");
  var apiReqPre = document.getElementById("api-req-pre");
  var apiResPre = document.getElementById("api-res-pre");
  var apiSandboxCard = document.getElementById("api-sandbox-card");

  function selectApiSimulation(projectKey, shouldScroll) {
    var sim = API_SIMULATIONS[projectKey];
    if (!sim) return;

    for (var i = 0; i < apiTabBtns.length; i++) {
      var isMatch = apiTabBtns[i].getAttribute("data-api") === projectKey;
      if (isMatch) {
        apiTabBtns[i].classList.add("active-api-tab");
      } else {
        apiTabBtns[i].classList.remove("active-api-tab");
      }
    }

    if (apiMethodLabel) apiMethodLabel.textContent = sim.method;
    if (apiReqPre) apiReqPre.textContent = sim.request;
    if (apiResPre) apiResPre.textContent = sim.response;

    if (shouldScroll && apiSandboxCard) {
      apiSandboxCard.scrollIntoView({ behavior: getScrollBehavior(), block: "nearest" });
    }
  }

  for (var a = 0; a < apiTabBtns.length; a++) {
    apiTabBtns[a].addEventListener("click", function () {
      selectApiSimulation(this.getAttribute("data-api"), false);
    });
  }

  for (var p = 0; p < projectSimBtns.length; p++) {
    projectSimBtns[p].addEventListener("click", function () {
      selectApiSimulation(this.getAttribute("data-sim"), true);
    });
  }

  /* ------------------------------------------------------------------------
     8. Interactive AWS Architecture Node Inspector
     ------------------------------------------------------------------------ */
  var awsNodeBtns = document.querySelectorAll(".aws-node-btn");
  var awsDetailTitle = document.getElementById("aws-detail-title");
  var awsDetailText = document.getElementById("aws-detail-text");

  for (var n = 0; n < awsNodeBtns.length; n++) {
    awsNodeBtns[n].addEventListener("click", function () {
      var idx = parseInt(this.getAttribute("data-node-index"), 10);
      var nodeData = AWS_NODES[idx];
      if (!nodeData) return;

      for (var k = 0; k < awsNodeBtns.length; k++) {
        awsNodeBtns[k].classList.remove("active-aws-node");
      }
      this.classList.add("active-aws-node");

      if (awsDetailTitle) awsDetailTitle.textContent = nodeData.step + " — " + nodeData.title;
      if (awsDetailText) awsDetailText.textContent = nodeData.detail;
    });
  }

  /* ------------------------------------------------------------------------
     9. Command Palette Modal (Ctrl+K / Cmd+K or Navbar Button)
     ------------------------------------------------------------------------ */
  var openCmdBtn = document.getElementById("open-cmd-btn");
  var closeCmdBtn = document.getElementById("close-cmd-btn");
  var cmdBackdrop = document.getElementById("cmd-modal-backdrop");
  var cmdSearchInput = document.getElementById("cmd-search-input");
  var cmdItemBtns = document.querySelectorAll(".cmd-item-btn");

  function openCommandPalette() {
    if (!cmdBackdrop) return;
    cmdBackdrop.hidden = false;
    if (cmdSearchInput) {
      cmdSearchInput.value = "";
      filterCommandItems("");
      cmdSearchInput.focus();
    }
  }

  function closeCommandPalette() {
    if (!cmdBackdrop) return;
    cmdBackdrop.hidden = true;
    if (openCmdBtn) openCmdBtn.focus();
  }

  function filterCommandItems(query) {
    var q = (query || "").toLowerCase();
    for (var i = 0; i < cmdItemBtns.length; i++) {
      var text = cmdItemBtns[i].textContent.toLowerCase();
      cmdItemBtns[i].parentElement.style.display = text.indexOf(q) !== -1 ? "block" : "none";
    }
  }

  if (openCmdBtn) {
    openCmdBtn.addEventListener("click", openCommandPalette);
  }
  if (closeCmdBtn) {
    closeCmdBtn.addEventListener("click", closeCommandPalette);
  }
  if (cmdBackdrop) {
    cmdBackdrop.addEventListener("click", function (e) {
      if (e.target === cmdBackdrop) closeCommandPalette();
    });
  }
  if (cmdSearchInput) {
    cmdSearchInput.addEventListener("input", function () {
      filterCommandItems(this.value);
    });
  }

  for (var m = 0; m < cmdItemBtns.length; m++) {
    cmdItemBtns[m].addEventListener("click", function () {
      var action = this.getAttribute("data-cmd-action");
      closeCommandPalette();

      if (action.indexOf("exhibit-") === 0) {
        var idx = parseInt(action.replace("exhibit-", ""), 10);
        jumpToMuseumAndOpen(idx);
      } else if (action === "theme") {
        toggleTheme();
      } else if (action.indexOf("#") === 0) {
        var targetEl = document.querySelector(action);
        if (targetEl) targetEl.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
      }
    });
  }

  /* ------------------------------------------------------------------------
     10. Global Keyboard Shortcuts (Esc, Arrow Keys, Ctrl+K)
     ------------------------------------------------------------------------ */
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (cmdBackdrop && !cmdBackdrop.hidden) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
      return;
    }

    if (cmdBackdrop && !cmdBackdrop.hidden && e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
      return;
    }

    if (!placardDrawer || placardDrawer.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closePlacard();
    } else if (e.key === "ArrowRight" && museumSectionContainsFocus()) {
      e.preventDefault();
      openPlacard(currentExhibitIndex + 1, false);
    } else if (e.key === "ArrowLeft" && museumSectionContainsFocus()) {
      e.preventDefault();
      openPlacard(currentExhibitIndex - 1, false);
    }
  });

  function museumSectionContainsFocus() {
    var museumSec = document.getElementById("museum");
    return museumSec && museumSec.contains(document.activeElement);
  }

  /* ------------------------------------------------------------------------
     11. Local Build-Log Screenshot Previewer for Exhibit #5
     ------------------------------------------------------------------------ */
  if (screenshotInput && screenshotImg) {
    screenshotInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (loadEvent) {
        if (loadEvent.target && loadEvent.target.result) {
          screenshotImg.src = loadEvent.target.result;
          screenshotImg.alt = "Uploaded AWS Amplify build log screenshot: " + file.name;
          if (screenshotCaption) {
            screenshotCaption.textContent = "Previewing local screenshot: " + file.name + " (To make permanent for production, save as assets/amplify-build-log.png)";
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------------
     12. Theme Toggle (Dark / Light)
     ------------------------------------------------------------------------ */
  var themeToggleBtn = document.getElementById("theme-toggle-btn");
  var themeToggleText = document.getElementById("theme-toggle-text");

  function initTheme() {
    var savedTheme = null;
    try {
      savedTheme = localStorage.getItem("sg_portfolio_theme");
    } catch (err) {
      savedTheme = null;
    }
    if (savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (themeToggleText) themeToggleText.textContent = "Dark Mode";
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "light" ? "dark" : "light";
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (themeToggleText) themeToggleText.textContent = "Dark Mode";
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (themeToggleText) themeToggleText.textContent = "Light Mode";
    }
    try {
      localStorage.setItem("sg_portfolio_theme", next);
    } catch (err) {}
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  /* ------------------------------------------------------------------------
     13. Initialize Portfolio
     ------------------------------------------------------------------------ */
  initTheme();
  renderExhibits();
  openPlacard(0, false);
  selectApiSimulation("nyaya", false);
})();
