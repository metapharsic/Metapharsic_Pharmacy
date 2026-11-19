const fs = require('fs');

function fixStore(file, fnName, typeName) {
  let code = fs.readFileSync(file, 'utf8');
  const target = `const [cart, setCartState] = useState<${typeName}[]>(${fnName}())`;
  const replacement = `const [cart, setCartState] = useState<${typeName}[]>([])`;
  if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Target not found in ${file}`);
  }
}

fixStore('src/lib/stores/pos-cart-store.ts', 'getPosCart', 'PosCartLine');
fixStore('src/lib/stores/billing2-cart-store.ts', 'getBilling2Cart', 'Billing2CartLine');
fixStore('src/lib/stores/pos2-cart-store.ts', 'getPos2Cart', 'Pos2CartLine');

