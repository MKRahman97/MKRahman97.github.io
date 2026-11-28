// Builds the page from content.json. All text lives there; this file only renders it.

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === undefined || value === null || value === false) return;
            if (key === 'text') node.textContent = value;
            else if (key === 'class') node.className = value;
            else node.setAttribute(key, value === true ? '' : value);
        });
    }
    (children || []).forEach(child => {
        if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
}

function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
}

function icon(className) {
    return el('i', { class: className, 'aria-hidden': 'true' });
}

// ── Light / dark theme ────────────────────────────────────────────────────────
// The inline script in <head> sets data-theme before first paint (saved choice,
// else the system setting). This keeps the button, browser bar colour and
// system changes in step with it.

const THEME_BAR = { dark: '#0F1B2D', light: '#FFFFFF' };

function applyTheme(theme, save) {
    document.documentElement.dataset.theme = theme;
    if (save) {
        try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_BAR[theme];
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const next = theme === 'dark' ? 'light' : 'dark';
        btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
        btn.title = 'Switch to ' + next + ' theme';
        btn.querySelector('i').className = next === 'light' ? 'bx bx-sun' : 'bx bx-moon';
    }
}

function initTheme() {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', false);
    document.getElementById('theme-toggle').addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
    // Follow the system setting until the visitor picks a theme themselves.
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', e => {
        let saved = null;
        try { saved = localStorage.getItem('theme'); } catch (err) { /* private mode */ }
        if (!saved) applyTheme(e.matches ? 'light' : 'dark', false);
    });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function initNav() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('nav');
    const topbar = document.getElementById('topbar');

    const close = () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        toggle.querySelector('i').className = 'bx bx-menu';
    };

    toggle.addEventListener('click', () => {
        const open = !nav.classList.contains('open');
        nav.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        toggle.querySelector('i').className = open ? 'bx bx-x' : 'bx bx-menu';
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !nav.classList.contains('open')) return;
        const inside = nav.contains(document.activeElement);
        close();
        if (inside) toggle.focus();
    });

    window.addEventListener('scroll', () => {
        topbar.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    // Mark the nav link for the section in view.
    const links = Array.from(nav.querySelectorAll('a'));
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    sections.push(document.getElementById('home'), document.getElementById('spectrum'));
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                // Above the first nav section nothing is marked.
                links.forEach(a => {
                    const current = a.getAttribute('href') === '#' + entry.target.id;
                    if (current) a.setAttribute('aria-current', 'true');
                    else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(s => observer.observe(s));
    }
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function renderSocial(list, container) {
    container.innerHTML = '';
    list.forEach(item => {
        const a = el('a', { href: item.href, target: '_blank', rel: 'noopener', 'aria-label': item.label }, [
            icon(item.icon), el('span', { text: item.label })
        ]);
        container.appendChild(el('li', null, [a]));
    });
}

function renderHero(data) {
    const hero = data.hero;
    document.getElementById('hero-name').textContent = hero.firstName + ' ' + hero.lastName;
    document.getElementById('hero-role').textContent = hero.role;
    document.getElementById('hero-pitch').textContent = hero.pitch;

    const readout = document.getElementById('hero-readout');
    readout.innerHTML = '';
    hero.readout.forEach(row => {
        readout.appendChild(el('div', null, [el('dt', { text: row.key }), el('dd', { text: row.value })]));
    });

    ['hero-cv', 'topbar-cv'].forEach(id => {
        const link = document.getElementById(id);
        link.href = hero.cvHref;
        link.setAttribute('download', hero.cvDownloadName);
    });

    const photo = document.getElementById('hero-photo');
    photo.alt = hero.photoAlt;

    renderSocial(data.social, document.getElementById('hero-social'));
}

// ── Spectrum: one labelled peak per highlight ─────────────────────────────────

function seededNoise(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

let spectrumState = { selected: 0, drawn: false, width: 0, announced: -1 };

function renderSpectrum(peaks, showAward) {
    const plot = document.getElementById('spectrum-plot');
    const readout = document.getElementById('spectrum-readout');
    const live = document.getElementById('spectrum-live');
    const hadFocus = plot.contains(document.activeElement);
    plot.innerHTML = '';

    // Drawn in real pixels at the plot's width, so labels stay readable on phones.
    const W = Math.max(Math.round(plot.clientWidth) - 8, 300);
    const narrow = W < 600;
    const H = narrow ? 200 : 230;
    const base = H - 32, top = narrow ? 44 : 46, left = 12, right = W - 12;
    const span = right - left;
    const sigma = Math.max(2, 3.2 * W / 1000);
    spectrumState.width = plot.clientWidth;

    // Small background peaks so the trace reads as a real spectrum.
    const rand = seededNoise(7);
    const minor = [];
    for (let i = 0; i < 34; i++) {
        minor.push({ x: left + rand() * span, h: 0.04 + rand() * 0.14 });
    }
    const major = peaks.map(p => ({ x: left + p.position * span, h: p.height }));
    const all = minor.concat(major);

    let d = '';
    for (let x = left; x <= right; x += 1) {
        let y = 0;
        for (const p of all) {
            const dx = x - p.x;
            if (Math.abs(dx) < sigma * 5) y += p.h * Math.exp(-(dx * dx) / (2 * sigma * sigma));
        }
        y = Math.min(y, 1.05);
        d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + (base - y * (base - top)).toFixed(1);
    }

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'spectrum-svg', role: 'group', 'aria-label': 'Highlights drawn as a mass spectrum' });

    // Axis and ticks
    root.appendChild(svg('line', { x1: left, y1: base, x2: right, y2: base, class: 'sp-axis' }));
    for (let i = 0; i <= 10; i++) {
        const x = left + (span * i) / 10;
        root.appendChild(svg('line', { x1: x, y1: base, x2: x, y2: base + 6, class: 'sp-tick' }));
    }
    const axisLabel = svg('text', { x: right, y: base + 24, 'text-anchor': 'end', class: 'sp-axis-label', 'aria-hidden': 'true' });
    axisLabel.textContent = 'm/z';
    root.appendChild(axisLabel);

    const trace = svg('path', { d, class: 'sp-trace', 'aria-hidden': 'true' });
    root.appendChild(trace);

    // One readout block per peak, stacked in the same grid cell, so the panel keeps
    // the height of the longest summary and the page never jumps on hover.
    readout.innerHTML = '';
    const items = peaks.map(peak => {
        const text = showAward && peak.awardSummary ? peak.awardSummary : peak.summary;
        const item = el('div', { class: 'readout-item' }, [
            el('p', { class: 'readout-label', text: peak.label }),
            el('p', { class: 'readout-text', text }),
            peak.link ? el('a', { class: 'readout-link', href: peak.link, text: peak.linkText }) : null
        ]);
        readout.appendChild(item);
        return { item, text };
    });

    const buttons = [];
    const select = (index, fromUser) => {
        spectrumState.selected = index;
        buttons.forEach((g, i) => {
            g.classList.toggle('active', i === index);
            g.setAttribute('aria-pressed', String(i === index));
        });
        items.forEach((it, i) => it.item.classList.toggle('active', i === index));
        // Announce only real changes the visitor made, not hovers back and forth or re-renders.
        if (fromUser && live && spectrumState.announced !== index) {
            spectrumState.announced = index;
            live.textContent = `${peaks[index].label}: ${items[index].text}`;
        }
    };

    peaks.forEach((peak, index) => {
        const x = left + peak.position * span;
        const yTop = base - Math.min(peak.height, 1.05) * (base - top);
        const g = svg('g', {
            class: 'sp-peak', tabindex: '0', role: 'button',
            'aria-label': peak.label, 'aria-pressed': 'false',
            'data-index': index
        });
        // Wide invisible hit area so peaks are easy to hit with a finger.
        const hit = Math.min(56, span * 0.14);
        g.appendChild(svg('rect', { x: x - hit / 2, y: 4, width: hit, height: base - 4, class: 'sp-hit' }));
        g.appendChild(svg('line', { x1: x, y1: base, x2: x, y2: yTop, class: 'sp-marker' }));
        g.appendChild(svg('circle', { cx: x, cy: yTop, r: 4.5, class: 'sp-dot' }));
        const label = svg('text', { x, y: yTop - 14, 'text-anchor': 'middle', class: 'sp-label', 'aria-hidden': 'true' });
        label.textContent = peak.label;
        g.appendChild(label);

        g.addEventListener('click', () => select(index, true));
        g.addEventListener('mouseenter', () => select(index, false));
        g.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(index, true); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + peaks.length) % peaks.length;
                buttons[next].focus();
                select(next, true);
            }
        });
        buttons.push(g);
        root.appendChild(g);
    });

    plot.appendChild(root);
    select(spectrumState.selected, false);
    if (hadFocus) buttons[spectrumState.selected].focus({ preventScroll: true });

    // One orchestrated moment: the trace draws itself once when the page opens.
    const firstDraw = !spectrumState.drawn;
    spectrumState.drawn = true;
    if (firstDraw && !REDUCED_MOTION && trace.getTotalLength) {
        const length = trace.getTotalLength();
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            trace.style.transition = '';
            trace.style.strokeDasharray = '';
            trace.style.strokeDashoffset = '';
            root.classList.remove('drawing');
        };
        trace.style.strokeDasharray = length;
        trace.style.strokeDashoffset = length;
        root.classList.add('drawing');
        trace.getBoundingClientRect(); // flush styles so the transition has a start value
        trace.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.6,.05,.3,1)';
        trace.style.strokeDashoffset = '0';
        trace.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 2300); // safety net: peaks must never stay hidden
    }
}

// ── Work ──────────────────────────────────────────────────────────────────────

function renderWork(data) {
    const container = document.getElementById('work-list');
    container.innerHTML = '';
    data.work.forEach(item => {
        const head = el('header', { class: 'work-head' }, [
            el('h3', { class: 'work-name', text: item.name }),
            el('p', { class: 'work-expansion', text: item.expansion }),
            el('p', { class: 'work-meta', text: `${item.org}, ${item.years}` })
        ]);
        if (item.award && data.meta.showAward) {
            head.appendChild(el('p', { class: 'work-award' }, [icon('bx bx-award'), item.award]));
        }

        const body = el('div', { class: 'work-body' }, [el('p', { class: 'work-summary', text: item.summary })]);
        if (item.points) {
            body.appendChild(el('ul', { class: 'work-points' }, item.points.map(p => el('li', { text: p }))));
        }
        body.appendChild(el('p', { class: 'work-result', text: item.result }));
        body.appendChild(el('ul', { class: 'stack', 'aria-label': 'Built with' }, item.stack.map(s => el('li', { text: s }))));
        if (item.link) {
            body.appendChild(el('a', { class: 'work-link', href: item.link, target: '_blank', rel: 'noopener' }, [
                item.linkText, icon('bx bx-link-external')
            ]));
        }

        container.appendChild(el('article', { class: 'work-item' + (item.featured ? ' featured' : ''), id: 'work-' + item.id }, [head, body]));
    });
}

// ── Experience and education ──────────────────────────────────────────────────

function renderTimeline(data) {
    const exp = document.getElementById('experience-list');
    exp.innerHTML = '';
    data.experience.forEach(job => {
        exp.appendChild(el('li', { class: 'timeline-item' }, [
            el('p', { class: 'timeline-years', text: job.years }),
            el('h4', { class: 'timeline-title', text: job.role }),
            el('p', { class: 'timeline-org', text: `${job.org}, ${job.location}` }),
            el('ul', { class: 'timeline-points' }, job.points.map(p => el('li', { text: p })))
        ]));
    });

    const edu = document.getElementById('education-list');
    edu.innerHTML = '';
    data.education.forEach(item => {
        edu.appendChild(el('li', { class: 'timeline-item' }, [
            el('p', { class: 'timeline-years', text: item.years }),
            el('h4', { class: 'timeline-title', text: item.degree }),
            el('p', { class: 'timeline-org', text: item.org }),
            item.note ? el('p', { class: 'timeline-note', text: item.note }) : null
        ]));
    });
}

// ── Publications ──────────────────────────────────────────────────────────────

function paperUrl(paper) {
    return paper.doi ? 'https://doi.org/' + paper.doi : paper.url;
}

function citationText(paper) {
    const where = paper.doi ? ` https://doi.org/${paper.doi}` : (paper.url ? ` ${paper.url}` : '');
    const volume = paper.volume ? `, ${paper.volume}` : '';
    return `${paper.authors} (${paper.year}). ${paper.title}. ${paper.journal}${volume}.${where}`;
}

// Author list with the site owner's name in bold.
function authorLine(authors, me) {
    const p = el('p', { class: 'paper-authors' });
    authors.split(me).forEach((part, i, parts) => {
        if (part) p.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) p.appendChild(el('strong', { text: me }));
    });
    return p;
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (e) { /* permission denied: fall through to the older method */ }
    }
    const area = el('textarea', { readonly: true, 'aria-hidden': 'true' });
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
}

function flash(button, message) {
    const label = button.querySelector('span') || button;
    const original = button.dataset.label || label.textContent;
    button.dataset.label = original;
    label.textContent = message;
    clearTimeout(button._flashTimer);
    button._flashTimer = setTimeout(() => { label.textContent = original; }, 2000);
}

function renderPapers(data) {
    const list = document.getElementById('paper-list');
    const filters = document.getElementById('paper-filters');
    list.innerHTML = '';
    filters.innerHTML = '';

    const items = data.publications.map(paper => {
        const link = el('a', { class: 'paper-title', href: paperUrl(paper), target: '_blank', rel: 'noopener', text: paper.title });
        const copy = el('button', { type: 'button', class: 'paper-copy' }, [icon('bx bx-copy'), el('span', { text: 'Copy citation' })]);
        copy.addEventListener('click', async () => {
            try { await copyText(citationText(paper)); flash(copy, 'Copied'); }
            catch (e) { flash(copy, 'Copy failed, select the text instead'); }
        });
        const li = el('li', { class: 'paper', 'data-topic': paper.topic }, [
            el('p', { class: 'paper-year', text: String(paper.year) }),
            el('div', { class: 'paper-main' }, [
                link,
                authorLine(paper.authors, data.meta.authorName || 'M. Rahman'),
                el('p', { class: 'paper-journal' }, [
                    el('span', { text: paper.journal + (paper.volume ? ', ' + paper.volume : '') }),
                    paper.firstAuthor ? el('span', { class: 'paper-tag', text: 'First author' }) : null
                ]),
                copy
            ])
        ]);
        list.appendChild(li);
        return li;
    });

    const buttons = data.paperTopics.map(topic => {
        const count = topic.id === 'all'
            ? data.publications.length
            : data.publications.filter(p => p.topic === topic.id).length;
        const btn = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(topic.id === 'all') }, [
            topic.label, el('span', { class: 'chip-count', text: String(count) })
        ]);
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
            items.forEach(li => { li.hidden = topic.id !== 'all' && li.dataset.topic !== topic.id; });
        });
        return count || topic.id === 'all' ? btn : null;
    }).filter(Boolean);
    buttons.forEach(b => filters.appendChild(b));
}

// ── Skills ────────────────────────────────────────────────────────────────────

function renderSkills(data) {
    const container = document.getElementById('skills-list');
    container.innerHTML = '';
    data.skills.forEach(group => {
        container.appendChild(el('div', { class: 'skill-group' }, [
            el('h3', { class: 'skill-title', text: group.group }),
            el('ul', { class: 'tags' }, group.items.map(s => el('li', { text: s })))
        ]));
    });
}

// ── Contact ───────────────────────────────────────────────────────────────────

function renderContact(data) {
    const c = data.contact;
    document.getElementById('contact-intro').textContent = c.intro;
    document.getElementById('contact-mail').href =
        `mailto:${c.email}?subject=${encodeURIComponent(c.mailSubject)}`;

    const copy = document.getElementById('contact-copy');
    copy.addEventListener('click', async () => {
        try { await copyText(c.email); flash(copy, 'Email address copied'); }
        catch (e) { flash(copy, c.email); }
    });

    renderSocial(data.social, document.getElementById('contact-social'));

    // The form only appears once a Web3Forms access key is set in content.json.
    if (!c.web3formsKey) return;
    const form = document.getElementById('contact-form');
    const status = document.getElementById('cf-status');
    const submit = document.getElementById('cf-submit');
    form.hidden = false;

    const setStatus = (message, kind) => {
        status.textContent = message;
        status.dataset.kind = kind || '';
    };

    form.addEventListener('input', e => {
        e.target.removeAttribute('aria-invalid');
        if (status.dataset.kind === 'error') setStatus('');
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const fields = ['cf-name', 'cf-email', 'cf-message'].map(id => document.getElementById(id));
        const invalid = fields.filter(f => !f.value.trim() || !f.checkValidity());
        fields.forEach(f => {
            if (invalid.includes(f)) {
                f.setAttribute('aria-invalid', 'true');
                f.setAttribute('aria-describedby', 'cf-status');
            } else {
                f.removeAttribute('aria-invalid');
                f.removeAttribute('aria-describedby');
            }
        });
        if (invalid.length) {
            setStatus(invalid[0].id === 'cf-email' && invalid[0].value.trim()
                ? 'Enter a valid email address.'
                : 'Fill in your name, email and message.', 'error');
            invalid[0].focus();
            return;
        }

        submit.disabled = true;
        submit.textContent = 'Sending…';
        setStatus('');
        const body = Object.fromEntries(new FormData(form));
        body.access_key = c.web3formsKey;
        body.subject = c.formSubject;
        body.from_name = 'mkrahman97.github.io';

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.message || response.status);
            form.reset();
            setStatus('Message sent. I’ll reply by email.', 'ok');
        } catch (err) {
            setStatus(`Your message didn’t send. Email me at ${c.email} instead.`, 'error');
        } finally {
            submit.disabled = false;
            submit.textContent = 'Send message';
        }
    });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNav();
    fetch('content.json')
        .then(r => {
            if (!r.ok) throw new Error('content.json returned ' + r.status);
            return r.json();
        })
        .then(data => {
            document.title = data.meta.siteTitle;
            document.getElementById('brand').textContent = data.meta.brand;
            document.getElementById('footer-text').textContent = data.meta.footer;
            renderHero(data);
            renderSpectrum(data.spectrum, data.meta.showAward);
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const width = document.getElementById('spectrum-plot').clientWidth;
                    if (Math.abs(width - spectrumState.width) > 4) renderSpectrum(data.spectrum, data.meta.showAward);
                }, 150);
            });
            renderWork(data);
            renderTimeline(data);
            renderPapers(data);
            renderSkills(data);
            renderContact(data);

            // Content arrives after the browser's own jump to #anchor, so redo it.
            if (location.hash) {
                const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
                if (target) setTimeout(() => target.scrollIntoView({ behavior: 'instant' }), 0);
            }
        })
        .catch(err => {
            console.error('content.json load error:', err);
            if (location.protocol === 'file:') {
                console.info('fetch() is blocked on file:// pages. Serve the folder over HTTP (see CLAUDE.md).');
            }
            const cv = document.getElementById('hero-cv').getAttribute('href');
            document.getElementById('main').prepend(el('p', { class: 'load-error' }, [
                'This page couldn’t load. Refresh to try again, or ',
                el('a', { href: cv, download: true, text: 'download the CV' }),
                ' or ',
                el('a', { href: 'mailto:mkrahman9707@gmail.com', text: 'email Mohammed' }),
                '.'
            ]));
        });
});
