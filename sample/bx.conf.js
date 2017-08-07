var c = module.exports = {}
// PCT = percentage
// ETH settings (note: this is just an example, not necessarily recommended)
// การตั้งค่า period สำคัญมากเพราะจะกระทบ ทุกอย่างที่ใช้ period ในการอ้างอิง เช่น ema, rsi, oversold
c.selector = 'bx.ETH-THB'
c.strategy = 'two_ema_with_rsi'
c.period = '4h'
c.min_periods = 50 // จำนวน periods ขึ้นต่ำที่เก็บเป็น history
// Paper trade
c.currency_capital = 1000 // จำนวนเงินเริ่มต้น ที่ใช้ในการ paper trade
c.asset_capital = 0 // จำนวน asset (coin) เริ่มต้น ที่ใช้ในการ paper trade
// Normal trade
c.buy_pct = 90 // ซื้อด้วยเงินจำนวน กี่เปอร์เซ็น
c.sell_pct = 90 // ขายด้วยเงินจำนวน กี่เปอร์เซ็น
// c.buy_stop_pct = 10// ซื้อเมื่อราคาเพิ่มขึ้น กี่เปอร์เซ็นจากราคาที่ขายไป
c.sell_stop_pct = 10// ขายเมื่อราคาลดลง กี่เปอร์เซ็นจากราคาที่ซื้อมา

c.order_adjust_time = 5000// จำนวนเวลาที่ใช้ปรับราคาซื้อขาย หน่วยเป็น millisec
c.order_poll_time = 500// จำนวนเวลา ต่อหนึ่งรอบที่ทำการดึงข้อมูลออเดอร์ หน่วยเป็น millisec
c.profit_stop_pct=50 // ขายเมื่อกำไร ลดลงต่ำกว่า กี่เปอร์เซ็น เช่น ได้ กำไร 29 แต่กำไรลดลงเรื่อยๆจนถึง 20 จึงขาย
// c.profit_stop_enable_pct=100 // ขายเมื่อได้กำไรทันที กี่เปอร์เซ็น
// c.max_sell_loss_pct = 10 // ไม่ขายถ้าหาก ขาดทุนเกิน กี่เปอร์เซ็น
// c.max_slippage_pct = 10 // ไม่ขายถ้าหาก ค่าความแตกต่าง ระหว่าง ราคาที่จะขายกับราคาที่มีการเปิดขาย กี่เปอร์เซ็น
// Strategy
c.length_first_ema = 3
c.length_second_ema = 6
// c.neutral_rate =
c.oversold_rsi_periods = 9 // จำนวน period
c.oversold_rsi = 10 // ซื้อเมื่อค่า RSI น้อยกว่าหรือเท่ากับ
// Not stable
// c.avg_slippage_pct = 10 // ค่า ความคลาดเคลื่อนที่ จำนวนกี่เปอร์เซ็น ที่ใช้ในการจำลองบน paper trade
// c.markup_pct = 1// จำนวนเปอร์เซ็นที่ใช้ในการปรับราคาขึ้นหรือลง ตอน order ซื้อ หรือ ขาย
