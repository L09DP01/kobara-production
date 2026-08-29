const fetch = require('node-fetch');

async function testSMS() {
  console.log("Sending SMS to webhook...");
  
  const res = await fetch('http://localhost:3000/api/sms/natcash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer natcash-kobara-secret-2026'
    },
    body: JSON.stringify({
      raw_message: "Vous avez re??u 8,250 HTG de WILKENS FLEURINORD 33271071 a 17:07 26/06/2026, contenu: TVP8K3B2. Votre solde: 16,740.26 HTG. TransCode: 26062687621075. Merci",
      sender: "NATCASH"
    })
  });
  
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

testSMS();
