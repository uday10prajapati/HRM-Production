import axios from 'axios';

async function testApply() {
  try {
    const payload = {
        userId: '2ddfdfc9-43bb-41ef-aa5c-0215c54c0ecd', // ud
        startDate: '2026-04-20',
        endDate: '2026-04-21',
        type: 'Casual',
        day_type: 'full',
        reason: 'Local Backend Test',
    };
    console.log("Applying leave...");
    const { data } = await axios.post('http://127.0.0.1:5001/api/leave/apply', payload);
    console.log("Result:", data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}
testApply();
