"use client";

import Link from "next/link";
import { Accordion, AppShell, Icon, SectionHeader } from "@/components/ui/primitives";
import { BrandHeader } from "@/components/Dashboard";

const FAQ = [
  { q: "តើខ្ញុំត្រូវចេះសរសេរកូដទេ?", a: "មិនចាំបាច់ទេ។ គ្រាន់តែប្រាប់ AI ជាភាសាខ្មែរថាអ្នកចង់បាន Bot បែបណា AI នឹងសួរបន្ថែម ហើយបង្កើតឲ្យអ្នកដោយស្វ័យប្រវត្តិ។" },
  { q: "តើ Token និងពាក្យសម្ងាត់របស់ខ្ញុំមានសុវត្ថិភាពទេ?", a: "មាន។ យើងមិនដែលស្នើសុំ BotFather Token ពាក្យសម្ងាត់ ឬកូនសោសម្ងាត់ក្នុងផ្ទាំងជជែកឡើយ។ ការភ្ជាប់ Telegram ធ្វើឡើងដោយចុចប៊ូតុងតែមួយ។" },
  { q: "តើ Bot ជាកម្មសិទ្ធិរបស់អ្នកណា?", a: "Bot ទិន្នន័យអតិថិជន និងកូដទាំងអស់ ជាកម្មសិទ្ធិរបស់អ្នក ១០០%។ អ្នកអាចនាំចេញទិន្នន័យបានគ្រប់ពេល។" },
  { q: "តើ Bot អាចទទួលការទូទាត់តាម ABA KHQR បានទេ?", a: "បាន។ អ្នកអាចជ្រើស ABA KHQR ផ្ទេរប្រាក់ផ្ទាល់ ឬទូទាត់ពេលដឹកដល់ (COD) នៅពេលរៀបចំ Bot។" },
  { q: "តើត្រូវចំណាយប៉ុន្មាន?", a: "អ្នកអាចចាប់ផ្តើមដោយឥតគិតថ្លៃ។ មើលគម្រោងទាំងអស់នៅក្នុង គណនី → គម្រោង & ការទូទាត់។" },
];

/** Help tab — FAQ and contact (no dedicated mockup; built from the design system). */
export default function HelpPage() {
  return (
    <AppShell header={<BrandHeader />}>
      <section className="ts-greet">
        <span className="ts-pill ts-pill-success"><Icon name="headset" size={16} />ជំនួយ</span>
        <h1>តើយើងអាចជួយអ្វីបានខ្លះ?</h1>
        <p>ចម្លើយរហ័សចំពោះសំណួរដែលគេសួរញឹកញាប់ ឬជជែកជាមួយក្រុមការងារផ្ទាល់។</p>
      </section>

      <section className="ts-stack">
        <SectionHeader icon="help" title="សំណួរញឹកញាប់" />
        {FAQ.map((f) => <Accordion key={f.q} title={f.q}><p className="ts-small ts-variant">{f.a}</p></Accordion>)}
      </section>

      <section className="ts-community">
        <div className="ts-stack" style={{ gap: 4 }}>
          <small><Icon name="headset" size={18} />សហគមន៍កម្ពុជា</small>
          <h4>ត្រូវការជំនួយពីអ្នកជំនាញ?</h4>
          <p>ចូលរួមជាមួយអ្នកបង្កើត Bot ជាង 2,400 នាក់</p>
        </div>
        {/* TODO(backend): official support/community Telegram link. */}
        <a href="https://t.me/" target="_blank" rel="noopener noreferrer"><span>ជជែកជាមួយក្រុមការងារ</span><Icon name="send" size={16} /></a>
      </section>

      <Link href="/bot-builder" className="ui-btn ui-primary ui-md ui-block"><Icon name="sparkles" size={18} />ចាប់ផ្តើមបង្កើត Bot</Link>
    </AppShell>
  );
}
