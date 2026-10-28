### Запуск тестов

Контейнер тестовой базы
```
docker compose -f docker-compose.test.yml up -d
```

Тест
```
$env:TEST_DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5433/art_classes_test"                                                    
pytest -v   
```