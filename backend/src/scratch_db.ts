import { supabase } from './config/supabaseClient.js';

async function main() {
    console.log("=== POCKETS ===");
    const { data: pockets, error: pe } = await supabase.from('pockets').select('*');
    if (pe) console.error(pe);
    else console.log(pockets);

    console.log("=== assets ===");
    const { data: assets, error: ae } = await supabase.from('assets').select('*');
    if (ae) console.error(ae);
    else console.log(assets);
}

main();
