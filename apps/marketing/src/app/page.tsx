const Home = () => {
    return (
        <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
                    Confirma
                </h1>
                <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                    Infraestrutura de confirmação de agenda para clínicas via WhatsApp.
                </p>
            </main>
        </div>
    );
};

export default Home;
