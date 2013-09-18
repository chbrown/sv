## Testing

Use this to generate `examples/r.txt`:

```R
PHRASES=c('drive standard', 'standard cars', 'waiting whatever',
  'closed hospital', 'cars speak', 'wish whatever', 'completely firm',
  'attack faith', 'race language', 'arm covered')
choices = c('funny', 'not_funny')
N = 10
df = data.frame(
  INDEX=1:N,
  REALS=rnorm(N, 3, 10),
  PHRASES=PHRASES,
  POSREALS=runif(N),
  INTEGERLIKE=rpois(N, 4),
  LOWTHO=rpois(N, 1),
  BINARY=rbinom(N, 1, 0.5),
  V1=choices[rbinom(N, 1, 0.4)+1],
  V2=choices[rbinom(N, 1, 0.9)+1],
  V3=choices[rbinom(N, 1, 0.0)+1],
  V3=choices[rbinom(N, 1, 0.6)+1])
write.table(df, 'examples/r.txt', row.names=FALSE)
```
