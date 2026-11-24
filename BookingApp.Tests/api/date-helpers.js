// Helper function to get a future booking date to test with
export function getFutureWorkDay(daysAhead = 2) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);

    // Jules does not work on Sundays
    if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}