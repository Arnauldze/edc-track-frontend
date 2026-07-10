#!/usr/bin/env node

/**
 * Script de vérification de l'intégration API
 * Vérifie que tous les fichiers nécessaires existent et sont corrects
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification de l\'intégration API...\n');

let errors = 0;
let warnings = 0;
let success = 0;

// Fonction de vérification
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}`);
    success++;
    return true;
  } else {
    console.log(`❌ ${description} - MANQUANT: ${filePath}`);
    errors++;
    return false;
  }
}

function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchString)) {
      console.log(`✅ ${description}`);
      success++;
      return true;
    } else {
      console.log(`⚠️  ${description} - Contenu manquant`);
      warnings++;
      return false;
    }
  } else {
    console.log(`❌ ${description} - Fichier manquant`);
    errors++;
    return false;
  }
}

console.log('📦 Vérification des dépendances...');
checkFileContent('package.json', '"axios"', 'Axios installé');

console.log('\n🔧 Vérification des services API...');
checkFile('src/services/api/client.ts', 'Client Axios');
checkFile('src/services/api/transformers.ts', 'Transformateurs');
checkFile('src/services/api/authService.ts', 'Service Auth');
checkFile('src/services/api/userService.ts', 'Service User');
checkFile('src/services/api/projectService.ts', 'Service Project');
checkFile('src/services/api/documentService.ts', 'Service Document');
checkFile('src/services/api/teamService.ts', 'Service Team');
checkFile('src/services/api/alertService.ts', 'Service Alert');
checkFile('src/services/api/dashboardService.ts', 'Service Dashboard');
checkFile('src/services/api/healthService.ts', 'Service Health');
checkFile('src/services/api/index.ts', 'Index des services');

console.log('\n🔄 Vérification des transformations...');
checkFileContent('src/services/api/transformers.ts', 'transformUserFromBackend', 'Transformation User (Backend → Frontend)');
checkFileContent('src/services/api/transformers.ts', 'transformUserToBackend', 'Transformation User (Frontend → Backend)');
checkFileContent('src/services/api/transformers.ts', 'transformLoginResponse', 'Transformation Login');

console.log('\n📝 Vérification de l\'utilisation des transformateurs...');
checkFileContent('src/services/api/userService.ts', 'transformUserFromBackend', 'userService utilise les transformateurs');
checkFileContent('src/services/api/authService.ts', 'transformLoginResponse', 'authService utilise les transformateurs');

console.log('\n🎨 Vérification des types TypeScript...');
checkFileContent('src/services/api/client.ts', 'InternalAxiosRequestConfig', 'Types Axios corrects');
checkFileContent('src/services/api/transformers.ts', 'BackendUser', 'Type BackendUser défini');
checkFileContent('src/services/api/transformers.ts', 'FrontendUser', 'Type FrontendUser défini');

console.log('\n📚 Vérification de la documentation...');
checkFile('TEST_API_INTEGRATION.md', 'Guide de test');
checkFile('EXAMPLE_API_USAGE.tsx', 'Exemples de code');
checkFile('src/services/api/README.md', 'README des services');

console.log('\n⚙️  Vérification de la configuration...');
checkFile('.env.local', 'Variables d\'environnement');
checkFileContent('.env.local', 'NEXT_PUBLIC_API_URL', 'URL de l\'API configurée');

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Résultats:`);
console.log(`   ✅ Succès:        ${success}`);
console.log(`   ⚠️  Avertissements: ${warnings}`);
console.log(`   ❌ Erreurs:       ${errors}`);

if (errors === 0 && warnings === 0) {
  console.log('\n🎉 Intégration complète et correcte!');
  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Démarrer le backend: cd ../backend && npm run start:dev');
  console.log('   2. Démarrer le frontend: npm run dev');
  console.log('   3. Tester le login: http://localhost:3000/login');
  console.log('   4. Consulter TEST_API_INTEGRATION.md pour les tests');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n⚠️  Intégration complète avec quelques avertissements');
  console.log('   Vérifiez les points ci-dessus');
  process.exit(0);
} else {
  console.log('\n❌ Intégration incomplète');
  console.log('   Corrigez les erreurs ci-dessus');
  process.exit(1);
}
