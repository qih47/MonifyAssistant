import nodemailer from 'nodemailer';

// Konfigurasi email (pakai Gmail App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'qisthih@gmail.com',
        pass: process.env.EMAIL_APP_PASSWORD // App Password dari Google
    }
});

// Mapping email notifikasi
const emailNotifications: Record<string, string> = {
    'suami': 'qisthih@gmail.com',  // Email Qisthi
    'istri': 'gitalarasrhtna@gmail.com'                     // Email Gita (kosongin dulu)
};

// ==========================================
// KIRIM NOTIFIKASI EMAIL TRANSAKSI
// ==========================================
export async function sendTransactionEmailNotification(data: {
    actor: string;
    amount: number;
    description: string;
    type: string;
    pocketName: string;
}) {
    try {
        const { actor, amount, description, type, pocketName } = data;
        
        // Tentukan siapa yang ngirim dan siapa yang nerima notif
        const pengirim = actor === 'suami' ? 'Qisthi' : 'Gita';
        const penerima = actor === 'suami' ? 'istri' : 'suami';
        const emailPenerima = emailNotifications[penerima];
        
        // Kalau email penerima kosong, skip
        if (!emailPenerima) {
            console.log(`ℹ️ Email ${penerima} belum diset, skip notifikasi.`);
            return;
        }

        const formattedAmount = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(amount);

        const tipeTransaksi = type === 'expense' ? 'Pengeluaran' : type === 'income' ? 'Pemasukan' : 'Transfer';
        const emoji = type === 'expense' ? '🔴' : type === 'income' ? '🟢' : '🔵';

        const mailOptions = {
            from: `"Monify Bot" <${process.env.EMAIL_USER}>`,
            to: emailPenerima,
            subject: `[Monify] ${emoji} Transaksi Baru: ${formattedAmount} - ${description}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #333;">🤖 Notifikasi Transaksi Baru</h2>
                    <hr>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">📝 Deskripsi</td>
                            <td style="padding: 10px;">${description}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">💰 Nominal</td>
                            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: ${type === 'expense' ? '#e74c3c' : '#2ecc71'};">${formattedAmount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">🔄 Jenis</td>
                            <td style="padding: 10px;">${tipeTransaksi}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">📂 Kantong</td>
                            <td style="padding: 10px;">${pocketName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">👤 Oleh</td>
                            <td style="padding: 10px;">${pengirim}</td>
                        </tr>
                    </table>
                    <hr>
                    <p style="color: #888; font-size: 12px; text-align: center;">
                        📱 Transaksi dicatat via Telegram Bot • Monify Financial Assistant
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email notifikasi terkirim ke ${emailPenerima}: ${info.messageId}`);

    } catch (err) {
        console.error('❌ Gagal kirim email:', err);
    }
}

// ==========================================
// KIRIM NOTIFIKASI EMAIL TAGIHAN JATUH TEMPO
// ==========================================
export async function sendBillReminderEmail(data: {
    billName: string;
    amount: number;
    dueDate: string;
    sisaHari: number;
}) {
    try {
        const { billName, amount, dueDate, sisaHari } = data;
        const formattedAmount = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(amount);

        // Kirim ke kedua email
        const emails = Object.values(emailNotifications).filter(e => e);
        
        if (emails.length === 0) return;

        const mailOptions = {
            from: `"Monify Bot" <${process.env.EMAIL_USER}>`,
            to: emails.join(', '),
            subject: `⚠️ [Monify] Pengingat: ${billName} jatuh tempo ${sisaHari} hari lagi!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #e74c3c;">⚠️ Pengingat Tagihan!</h2>
                    <hr>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">📝 Tagihan</td>
                            <td style="padding: 10px;">${billName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">💰 Nominal</td>
                            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #e74c3c;">${formattedAmount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">📅 Jatuh Tempo</td>
                            <td style="padding: 10px;">${dueDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">⏰ Sisa Waktu</td>
                            <td style="padding: 10px; font-weight: bold; color: #e74c3c;">${sisaHari} hari lagi!</td>
                        </tr>
                    </table>
                    <hr>
                    <p style="text-align: center;">
                        <a href="https://t.me/MonifyBot" style="background: #0088cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">💬 Bayar via Telegram</a>
                    </p>
                    <p style="color: #888; font-size: 12px; text-align: center;">
                        📱 Monify Financial Assistant
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Email reminder tagihan terkirim: ${billName}`);

    } catch (err) {
        console.error('❌ Gagal kirim email reminder:', err);
    }
}