export default function Home() {
  return (
    <main>
      <a className="brand" href="/">
        EventCraft
      </a>
      <section>
        <span className="mark" aria-hidden>
          Е
        </span>
        <h1>
          Рабочее пространство
          <br />
          готовится к запуску
        </h1>
        <p>
          Собирайте предложения в своём бренде, показывайте пространство и
          обсуждайте решения с клиентом.
        </p>
        <div className="notice">
          Доступ к новому кабинету откроется после подключения защищённого
          пространства.
        </div>
        <p className="note">
          Тестовая среда · предложения и клиентские данные здесь пока не
          принимаются.
        </p>
      </section>
      <footer>Предложения для событий</footer>
    </main>
  );
}
