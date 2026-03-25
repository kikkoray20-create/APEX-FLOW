export const parseDateToComparable = (dateStr: string): number => {
    if (!dateStr) return 0;
    try {
        const [dPart, tPart, ampm] = dateStr.split(' ');
        const separator = dPart.includes('/') ? '/' : dPart.includes('-') ? '-' : null;
        if (separator) {
            const parts = dPart.split(separator).map(Number);
            if (parts.length === 3) {
                let d = parts[0], m = parts[1], y = parts[2];
                if (parts[0] > 1000) { y = parts[0]; m = parts[1]; d = parts[2]; }
                let hh = 0, mm = 0;
                if (tPart) {
                    const timeParts = tPart.split(':').map(Number);
                    hh = timeParts[0] || 0;
                    mm = timeParts[1] || 0;
                    if (ampm === 'PM' && hh < 12) hh += 12;
                    if (ampm === 'AM' && hh === 12) hh = 0;
                }
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    return new Date(y, m - 1, d, hh, mm).getTime();
                }
            }
        }
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
    } catch (e) {
        console.warn('Failed to parse date to comparable:', dateStr, e);
    }
    return 0;
};
export const parseOrderDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
        }
        
        // Handle DD/MM/YYYY or DD-MM-YYYY
        const dPart = dateStr.split(' ')[0];
        const separator = dPart.includes('/') ? '/' : dPart.includes('-') ? '-' : null;
        
        if (separator) {
            const parts = dPart.split(separator).map(Number);
            // Check if it's DD/MM/YYYY or MM/DD/YYYY based on typical values
            // Assuming DD/MM/YYYY as per the original code
            if (parts.length === 3) {
                let d = parts[0], m = parts[1], y = parts[2];
                // If year is first (YYYY-MM-DD)
                if (parts[0] > 1000) {
                    y = parts[0]; m = parts[1]; d = parts[2];
                }
                // Ensure valid date
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    return new Date(y, m - 1, d).toISOString().split('T')[0];
                }
            }
        }
        
        // Fallback to standard Date parsing
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    } catch (e) {
        console.warn('Failed to parse date:', dateStr, e);
    }
    return '';
};
