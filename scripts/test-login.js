const bcrypt = require('bcryptjs');

// 測試密碼驗證
const password = 'admin123';
const hash = '$2b$10$fDcSbxG/5xghA7KHG2Jb2OHZ30XuGelX/6jsr.Pc2sqw9EpGnPHSS';

console.log('Testing password verification...');
console.log('Password:', password);
console.log('Hash:', hash);

bcrypt.compare(password, hash).then(result => {
  console.log('Match:', result);
  if (result) {
    console.log('✅ Password verification works!');
  } else {
    console.log('❌ Password verification failed!');
  }
}).catch(err => {
  console.error('Error:', err);
});
