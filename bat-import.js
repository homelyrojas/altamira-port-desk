(function (global) {
  'use strict';

  const DEFAULT_DATE_REGEX = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;

  function clean(value) {
    return String(value ?? '')
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function normalize(value) {
    return clean(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function parseDateMX(value) {
    const text = clean(value);
    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;

    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  }

  function formatHour(value) {
    const text = clean(value);
    if (!text) return '';

    const decimal = text.match(/^(\d{1,2})(?:\.(\d+))$/);
    if (decimal) {
      const hours = Number(decimal[1]);
      const minutes = Math.round(Number(`0.${decimal[2]}`) * 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?/);
    if (match) {
      const hh = String(Number(match[1])).padStart(2, '0');
      const mm = String(Number(match[2] ?? '0')).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    return text;
  }

  function isHeaderRow(values, expectedHeaders = []) {
    const normalizedValues = values.map(normalize).filter(Boolean);
    const normalizedHeaders = expectedHeaders.map(normalize).filter(Boolean);
    const matches = normalizedHeaders.filter(header => normalizedValues.includes(header));

    if (matches.length >= 2) return true;
    return normalizedValues[0] === 'buque' || normalizedValues[0] === 'vessel';
  }

  function normalizeDelimitedLine(line) {
    return clean(line)
      .replace(/[|;,]/g, '\t')
      .replace(/\t+/g, '\t');
  }

  function findKnownAtStart(text, knownValues = []) {
    const originalText = clean(text);
    const normalizedText = normalize(originalText);

    const sortedValues = [...knownValues].sort((a, b) => clean(b).length - clean(a).length);

    for (const value of sortedValues) {
      const normalizedValue = normalize(value);
      if (normalizedText === normalizedValue || normalizedText.startsWith(`${normalizedValue} `)) {
        return {
          value: clean(originalText.slice(0, clean(value).length)) || clean(value),
          rest: clean(originalText.slice(clean(value).length))
        };
      }
    }

    return null;
  }

  function findKnownInside(text, knownValues = []) {
    const originalText = clean(text);
    const normalizedText = normalize(originalText);
    const sortedValues = [...knownValues].sort((a, b) => clean(b).length - clean(a).length);

    for (const value of sortedValues) {
      const normalizedValue = normalize(value);
      const index = normalizedText.indexOf(normalizedValue);
      if (index >= 0) {
        const before = clean(originalText.slice(0, index));
        const matched = clean(originalText.slice(index, index + clean(value).length)) || clean(value);
        const after = clean(originalText.slice(index + clean(value).length));
        return { before, value: matched, after };
      }
    }

    return null;
  }

  function splitLines(text) {
    return String(text ?? '')
      .split('\n')
      .map(line => line.replace(/\r/g, ''));
  }

  function parseRows(text, options = {}) {
    const expectedHeaders = options.expectedHeaders || [];
    const minColumns = options.minColumns || 2;
    const mapRow = options.mapRow;
    const validate = options.validate || (() => true);

    return splitLines(text)
      .map(normalizeDelimitedLine)
      .filter(line => clean(line))
      .map(line => line.split('\t').map(clean))
      .filter(row => row.length >= minColumns && !isHeaderRow(row, expectedHeaders))
      .map(row => (typeof mapRow === 'function' ? mapRow(row) : row))
      .filter(validate);
  }

  function parseSchedule(text, options = {}) {
    const expectedHeaders = options.expectedHeaders || [];
    const services = options.services || [];
    const ports = options.ports || [];
    const validate = options.validate || (item => Boolean(item?.buque && item?.etaFecha && parseDateMX(item.etaFecha)));

    const tabularRecords = parseRows(text, {
      expectedHeaders,
      minColumns: 5,
      mapRow: row => ({
        buque: clean(row[0]),
        service: clean(row[1]),
        etaFecha: clean(row[2]),
        hora: formatHour(row[3]),
        puertoArribo: clean(row[4]),
        puertoZarpe: clean(row[5]),
        notas: row.slice(6).map(clean).filter(Boolean).join(' ')
      }),
      validate
    });

    const flexibleRecords = splitLines(text)
      .map(line => parseScheduleLine(line, { expectedHeaders, services, ports, validate }))
      .filter(Boolean);

    return dedupeRecords([...tabularRecords, ...flexibleRecords], item => [
      normalize(item.buque),
      normalize(item.etaFecha),
      formatHour(item.hora),
      normalize(item.puertoArribo),
      normalize(item.puertoZarpe)
    ].join('|'));
  }

  function parseScheduleLine(line, options = {}) {
    const expectedHeaders = options.expectedHeaders || [];
    const services = options.services || [];
    const ports = options.ports || [];
    const validate = options.validate || (() => true);

    const compactLine = clean(line).replace(/\s+/g, ' ');
    if (!compactLine || isHeaderRow([compactLine], expectedHeaders)) return null;

    const dateMatch = compactLine.match(DEFAULT_DATE_REGEX);
    if (!dateMatch) return null;

    const left = clean(compactLine.slice(0, dateMatch.index));
    const etaFecha = dateMatch[0];
    const right = clean(compactLine.slice(dateMatch.index + etaFecha.length));
    const hourMatch = right.match(/^(\d{1,2}(?::\d{1,2})?|\d{1,2}\.\d+)/);
    if (!hourMatch) return null;

    const hora = formatHour(hourMatch[1]);
    let remainder = clean(right.slice(hourMatch[1].length));

    const arribo = findKnownAtStart(remainder, ports);
    if (!arribo) return null;
    remainder = arribo.rest;

    const zarpe = findKnownAtStart(remainder, ports);
    if (!zarpe) return null;

    const serviceMatch = findKnownInside(left, services);
    if (!serviceMatch) return null;

    const record = {
      buque: serviceMatch.before,
      service: serviceMatch.value,
      etaFecha,
      hora,
      puertoArribo: arribo.value,
      puertoZarpe: zarpe.value,
      notas: zarpe.rest
    };

    return validate(record) ? record : null;
  }

  function dedupeRecords(records, keyFactory) {
    const seen = new Set();
    return records.filter(item => {
      const key = keyFactory(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  global.BATImport = {
    clean,
    normalize,
    parseDateMX,
    formatHour,
    parseRows,
    parseSchedule,
    dedupeRecords
  };
})(window);
