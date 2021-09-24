const Millis = {
    fromSec: (time) => time * 1000,
    fromMin: (time) => time * 60 * 1000,
    fromHrs: (time) => time * 60 * 60 * 1000,
    fromDay: (time) => time * 24 * 60 * 60 * 1000,
    fromYrs: (time) => time * 365 * 24 * 60 * 60 * 1000,
    toSec: (time) => Math.floor(time / 1000),
    toMin: (time) => Math.floor(time / 1000 / 60),
    toHrs: (time) => Math.floor(time / 1000 / 60 / 60),
    toDay: (time) => Math.floor(time / 1000 / 60 / 60 / 24),
    toYrs: (time) => Math.floor(time / 1000 / 60 / 60 / 24 / 365),
    inf: (time) => Number.POSITIVE_INFINITY,
};

function elapsedToStringHelper(elapsed, result, total, fmt, name, from, to, mul=1) {
    if (name in fmt) {
        const value = Math.max(fmt[name], Math.floor(to(elapsed - total)/mul));
        total += from(value*mul);
        if (value > 0) {
            if (!!result)
                result += ', ';
            result += `${value} ${name}`;
        }
    }
    return { result, total };
}

module.exports = {
    Millis,
    elapsedToString: (elapsed, fmt) => {
            let total = 0;
            let result = '';

            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'years', Millis.fromYrs, Millis.toYrs));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'weeks', Millis.fromDay, Millis.toDay, 7));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'days', Millis.fromDay, Millis.toDay));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'hours', Millis.fromHrs, Millis.toHrs));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'minutes', Millis.fromMin, Millis.toMin));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'seconds', Millis.fromSec, Millis.toSec));
            ({ result, total } = elapsedToStringHelper(elapsed, result, total, fmt, 'millis', (time) => time, (time) => time));

            const idx = result.lastIndexOf(', ');
            if (idx >= 0)
                result = result.slice(0, idx) + ' and ' + result.slice(idx+2);
            return result;
        }
};