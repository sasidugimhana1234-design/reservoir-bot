const firebaseConfig = {
  apiKey: "AIzaSyBL0GueL3u9iWjNBIMNIaPI4wIrOFZp7ZU",
  authDomain: "seylon-weathar.firebaseapp.com",
  databaseURL: "https://seylon-weathar-default-rtdb.firebaseio.com",
  projectId: "seylon-weathar",
  storageBucket: "seylon-weathar.firebasestorage.app",
  messagingSenderId: "1010230717979",
  appId: "1:1010230717979:web:b9f013e7a66c071a2192be"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.getElementById('registrationForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const name = document.getElementById('UserName').value.trim();
  const phone = document.getElementById('UserNumber').value.trim();
  const reservoir = document.getElementById('UserReservoir').value;
  const language = document.getElementById('UserLanguage').value;

  let formattedPhone = phone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '94' + formattedPhone.slice(1);
  }

  db.collection('users').doc(formattedPhone).set({
    name: name,
    phone: formattedPhone,
    reservoir: reservoir,
    language: language,
    registeredAt: new Date().toISOString()
}).then(() => {
    alert("ස්තූතියි " + name + "! ඔබගේ විස්තර සාර්ථකව සුරැකිණි.");
    document.getElementById('registrationForm').reset();
}).catch((error) => {
    alert("දත්ත සුරැකීමට අපොහොසත් විය: " + error.message);
});
});